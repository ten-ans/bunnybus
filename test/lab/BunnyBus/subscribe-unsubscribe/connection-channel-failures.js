'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const BunnyBus = require('../../../../lib');
const Exceptions = require('../../../../lib/exceptions');

const { describe, before, beforeEach, after, afterEach, it } = (exports.lab = Lab.script());
const expect = Code.expect;

let instance = undefined;
let connectionManager = undefined;
let channelManager = undefined;
let channelContext = undefined;

describe('BunnyBus', () => {
    before(() => {
        instance = new BunnyBus();
        instance.config = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
        connectionManager = instance.connections;
        channelManager = instance.channels;
    });

    describe('public methods', () => {
        describe('connection and channel failure tests', () => {
            const baseChannelName = 'bunnybus-negative-tests';
            const baseQueueName = 'test-negative-tests-queue';
            const baseErrorQueueName = `${baseQueueName}_error`;
            const consumerTag = 'abcde12345';
            const handlers = { event1: () => {} };

            before(async () => {
                channelContext = await instance._autoBuildChannelContext({ channelName: baseChannelName });

                await Promise.all([
                    channelContext.channel.deleteExchange(instance.config.globalExchange),
                    channelContext.channel.deleteQueue(baseQueueName),
                    channelContext.channel.deleteQueue(baseErrorQueueName)
                ]);
            });

            afterEach(async () => {
                await instance.unsubscribe({ queue: baseQueueName });

                instance.subscriptions._subscriptions.clear();
                instance.subscriptions._blockQueues.clear();
            });

            after(async () => {
                await instance._autoBuildChannelContext({ channelName: baseChannelName });

                await Promise.all([
                    channelContext.channel.deleteExchange(instance.config.globalExchange),
                    channelContext.channel.deleteQueue(baseQueueName),
                    channelContext.channel.deleteQueue(baseErrorQueueName)
                ]);

                await instance.stop();
            });

            it('should throw SubscriptionExistError when calling subscribe on an active subscription exist', async () => {
                let result = null;

                instance.subscriptions.create(baseQueueName, handlers);
                instance.subscriptions.tag(baseQueueName, consumerTag);

                try {
                    await instance.subscribe({ queue: baseQueueName, handlers });
                } catch (err) {
                    result = err;
                }

                expect(result).to.be.an.error(Exceptions.SubscriptionExistError);
            });

            it('should throw SubscriptionBlockedError when calling subscribe against a blocked queue', async () => {
                let result = null;

                instance.subscriptions.block(baseQueueName);

                try {
                    await instance.subscribe({ queue: baseQueueName, handlers });
                } catch (err) {
                    result = err;
                }

                expect(result).to.be.an.error(Exceptions.SubscriptionBlockedError);
            });

            it('should not error when connection does not pre-exist', async () => {
                await connectionManager.close(BunnyBus.DEFAULT_CONNECTION_NAME);

                await instance.subscribe({ queue: baseQueueName, handlers });
            });

            it('should not error when channel does not pre-exist', async () => {
                await channelManager.close(BunnyBus.QUEUE_CHANNEL_NAME(baseQueueName));

                await instance.subscribe({ queue: baseQueueName, handlers });
            });
        });
    });
});
