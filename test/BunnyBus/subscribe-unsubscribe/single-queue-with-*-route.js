'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const BunnyBus = require('../../../lib');

const { describe, before, beforeEach, after, afterEach, it } = (exports.lab = Lab.script());
const expect = Code.expect;

let instance = undefined;
let channelContext = undefined;

describe('BunnyBus', () => {
    before(() => {
        instance = new BunnyBus();
        instance.config = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
    });

    describe('public methods', () => {
        describe('subscribe / unsubscribe (single queue with * route)', () => {
            const baseChannelName = 'bunnybus-subscribe';
            const baseQueueName = 'test-subscribe-queue';
            const baseErrorQueueName = `${baseQueueName}_error`;
            const subscriptionKey = 'abc.*.xyz';
            const routableObject = { event: 'abc.helloworld.xyz', name: 'bunnybus' };

            before(async () => {
                channelContext = await instance._autoBuildChannelContext(baseChannelName);

                await Promise.all([
                    channelContext.channel.deleteExchange(instance.config.globalExchange),
                    channelContext.channel.deleteQueue(baseQueueName),
                    channelContext.channel.deleteQueue(baseErrorQueueName)
                ]);
            });

            afterEach(async () => {
                await instance.unsubscribe(baseQueueName);
            });

            after(async () => {
                await Promise.all([
                    channelContext.channel.deleteExchange(instance.config.globalExchange),
                    channelContext.channel.deleteQueue(baseQueueName),
                    channelContext.channel.deleteQueue(baseErrorQueueName)
                ]);
            });

            it('should consume message (Object) from queue and acknowledge off', async () => {
                return new Promise(async (resolve) => {
                    const handlers = {};
                    handlers[subscriptionKey] = async (consumedMessage, ack) => {
                        expect(consumedMessage).to.be.equal(routableObject);

                        await ack();
                        resolve();
                    };

                    await instance.subscribe(baseQueueName, handlers);
                    await instance.publish(routableObject);
                });
            });
        });
    });
});
