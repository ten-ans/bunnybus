'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Assertions = require('../assertions');
const BunnyBus = require('../../lib');

const { describe, before, beforeEach, after, afterEach, it } = (exports.lab = Lab.script());
const expect = Code.expect;

let instance = undefined;
let connectionManager = undefined;
let connectionContext = undefined;
let channelContext = undefined;
let channelManager = undefined;

describe('BunnyBus', () => {
    before(() => {
        instance = new BunnyBus();
        instance.config = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
        connectionManager = instance.connections;
        channelManager = instance.channels;
    });

    describe('public methods', () => {
        describe('_requeue', () => {
            const baseChannelName = 'bunnybus-requeue';
            const baseQueueName = 'test-requeue-queue';
            const message = { name: 'bunnybus', event: 'a' };
            const pattern = 'a';

            before(async () => {
                channelContext = await instance._autoBuildChannelContext(baseChannelName);
                connectionContext = channelContext.connectionContext;

                await Promise.all([
                    channelContext.channel.assertExchange(
                        instance.config.globalExchange,
                        'topic',
                        BunnyBus.DEFAULT_EXCHANGE_CONFIGURATION
                    ),
                    channelContext.channel.assertQueue(baseQueueName, BunnyBus.DEFAULT_QUEUE_CONFIGURATION),
                    channelContext.channel.bindQueue(baseQueueName, instance.config.globalExchange, pattern)
                ]);
            });

            beforeEach(async () => {
                await channelContext.channel.purgeQueue(baseQueueName);
            });

            after(async () => {
                await Promise.all([
                    channelContext.channel.deleteExchange(instance.config.globalExchange),
                    channelContext.channel.deleteQueue(baseQueueName)
                ]);
                await instance.stop();
            });

            it('should requeue a message off the queue', async () => {
                await Assertions.autoRecoverChannel(
                    async () => {
                        await instance.publish(message);
                        const payload = await instance.get(baseQueueName);

                        await instance._requeue(payload, BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName), baseQueueName);
                        const result = await channelContext.channel.checkQueue(baseQueueName);

                        expect(result.queue).to.be.equal(baseQueueName);
                        expect(result.messageCount).to.be.equal(1);
                    },
                    connectionContext,
                    channelContext,
                    channelManager
                );
            });

            it('should requeue with well formed header properties', async () => {
                const publishOptions = {
                    source: 'test'
                };

                let payload = null;
                let transactionId = null;
                let createdAt = null;

                await instance.publish(message, publishOptions);
                payload = await instance.get(baseQueueName);

                transactionId = payload.properties.headers.transactionId;
                createdAt = payload.properties.headers.createdAt;

                await instance._requeue(payload, BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName), baseQueueName);
                payload = await instance.get(baseQueueName);

                expect(payload.properties.headers.transactionId).to.be.equal(transactionId);
                expect(payload.properties.headers.createdAt).to.be.equal(createdAt);
                expect(payload.properties.headers.source).to.be.equal(publishOptions.source);
                expect(payload.properties.headers.requeuedAt).to.exist();
                expect(payload.properties.headers.retryCount).to.be.equal(1);
                expect(payload.properties.headers.routeKey).to.be.equal(message.event);
                expect(payload.properties.headers.bunnyBus).to.be.equal(require('../../package.json').version);
            });

            it('should not error when connection does not pre-exist', async () => {
                await Assertions.autoRecoverChannel(
                    async () => {
                        await instance.publish(message);
                        const payload = await instance.get(baseQueueName);

                        await connectionManager.close(BunnyBus.DEFAULT_CONNECTION_NAME);

                        await instance._requeue(payload, BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName), baseQueueName);
                    },
                    connectionContext,
                    channelContext,
                    channelManager
                );
            });

            it('should not error when channel does not pre-exist', async () => {
                await Assertions.autoRecoverChannel(
                    async () => {
                        await instance.publish(message);
                        const payload = await instance.get(baseQueueName);

                        await channelManager.close(BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName));

                        await instance._requeue(payload, BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName), baseQueueName);
                    },
                    connectionContext,
                    channelContext,
                    channelManager
                );
            });
        });
    });
});
