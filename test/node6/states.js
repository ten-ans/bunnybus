'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const BunnyBus = require('../../lib');
const Helpers = require('../../lib/helpers');
const { Promisify } = require('../promisify');
const { ChannelManager, ConnectionManager, SubscriptionManager } = require('../../lib/states');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const before = lab.before;
const beforeEach = lab.beforeEach;
const it = lab.it;
const expect = Code.expect;

describe('state management', () => {

    describe('Connection Manager', () => {

        let instance = undefined;
        let defaultConfiguration = undefined;

        beforeEach(() => {

            instance = new ConnectionManager();
            defaultConfiguration = BunnyBus.DEFAULT_SERVER_CONFIGURATION;
        });

        describe('create', () => {

            const baseConnectionName = 'connection-createConnection';

            it('should create a connection with default values', async () => {

                await instance.create(baseConnectionName, defaultConfiguration);

                const result = instance._connections.get(baseConnectionName);

                expect(result).to.exist();
                expect(result).to.be.an.object();
                expect(result.connectionOptions).to.exist();
                expect(result.connectionOptions).to.contain(defaultConfiguration);
                expect(result.connection).to.exist();
                expect(result.connection).to.be.an.object();
            });

            it('should create a connection with defaults values while supplied with empty net/tls options', async () => {

                await instance.create(baseConnectionName, defaultConfiguration, {});

                const result = instance._connections.get(baseConnectionName);

                expect(result).to.exist();
                expect(result).to.be.an.object();
                expect(result.connectionOptions).to.exist();
                expect(result.connectionOptions).to.contain(defaultConfiguration);
                expect(result.connection).to.exist();
                expect(result.connection).to.be.an.object();
            });

            it('should create a connection with defaults values while supplied with partially filled net/tls options', async () => {

                await instance.create(baseConnectionName, defaultConfiguration, { allowHalfOpen: true });

                const result = instance._connections.get(baseConnectionName);

                expect(result).to.exist();
                expect(result).to.be.an.object();
                expect(result.connectionOptions).to.exist();
                expect(result.connectionOptions).to.contain(defaultConfiguration);
                expect(result.connection).to.exist();
                expect(result.connection).to.be.an.object();
            });

            it('should return same connection when request are called concurrently', async () => {

                const [result1, result2] = await Promise.all([
                    instance.create(baseConnectionName, defaultConfiguration),
                    instance.create(baseConnectionName, defaultConfiguration)
                ]);

                expect(result1).to.exist();
                expect(result2).to.exist();
                expect(result1).to.shallow.equal(result2);
            });

            it('should return same connection when request are called sequentially', async () => {

                const result1 = await instance.create(baseConnectionName, defaultConfiguration);
                const result2 = await instance.create(baseConnectionName, defaultConfiguration);

                expect(result1).to.exist();
                expect(result2).to.exist();
                expect(result1).to.shallow.equal(result2);
            });

            it('should error when no connection options is supplied', async () => {

                let sut = null;

                try {
                    await instance.create(baseConnectionName);
                }
                catch (err) {
                    sut = err;
                }

                expect(sut).to.exist();
                expect(sut).to.be.an.error('Expected connectionOptions to be supplied');
            });

            it('should error when a misconfigured object is supplied', { timeout: 10000 }, async () => {

                let sut = null;

                try {
                    await instance.create(baseConnectionName, { port: 60000, connectionRetryCount: 1 });
                }
                catch (err) {
                    sut = err;
                }

                expect(sut).to.exist();
                expect(sut).to.be.an.error('Exceeded maximum attempts of retries');
            });
        });

        describe('contains', () => {

            const baseConnectionName = 'connection-containsConnection';

            it('should return true when connection context exist', async () => {

                await instance.create(baseConnectionName, defaultConfiguration);

                const result = instance.contains(baseConnectionName);

                expect(result).to.be.true();
            });

            it('should return false when connection context does not exist', async () => {

                const result = instance.contains(baseConnectionName);

                expect(result).to.be.false();
            });
        });

        describe('get', () => {

            const baseConnectionName = 'connection-getConnection';

            it('should return a connection context when it exist', async () => {

                const connection = await instance.create(baseConnectionName, defaultConfiguration);

                const result = instance.get(baseConnectionName);

                expect(result).to.exist();
                expect(result.name).to.equal(baseConnectionName);
                expect(result.connectionOptions).to.contains(defaultConfiguration);
                expect(result.connection).to.shallow.equal(connection);
                expect(result).to.not.shallow.equal(instance._connections.get(baseConnectionName));
            });

            it('should be undefined when the connection context does not exist', async () => {

                const result = instance.get(baseConnectionName);

                expect(result).to.not.exist();
                expect(result).to.be.undefined();
            });
        });

        describe('getConnection', () => {

            const baseConnectionName = 'connection-getConnectionConnection';

            it('should return a connection when it exist', async () => {

                const connection = await instance.create(baseConnectionName, defaultConfiguration);

                const result = instance.getConnection(baseConnectionName);

                expect(result).to.exist();
                expect(result).to.shallow.equal(connection);
            });

            it('should be undefined when the connection does not exist', async () => {

                const result = instance.get(baseConnectionName);

                expect(result).to.not.exist();
                expect(result).to.be.undefined();
            });
        });

        describe('closeConnection', () => {

            const baseConnectionName = 'connection-closeConnectionConnection';

            it('should close connection when it exist', async () => {

                await instance.create(baseConnectionName, defaultConfiguration);

                await instance.closeConnection(baseConnectionName);

                const result = instance._connections.get(baseConnectionName);

                expect(result).to.exist();
                expect(result.name).to.equal(baseConnectionName);
                expect(result.connection).to.not.exist();
                expect(result.connection).to.be.undefined();
            });
        });
    });

    describe('ChannelManager', () => {

        let instance = undefined;

        before(() => {

            instance = new ChannelManager();
        });

        beforeEach(() => {

        });


    });


    describe('SubscriptionManager', () => {

        let instance = undefined;

        before(() => {

            instance = new SubscriptionManager();
        });

        beforeEach(() => {

            instance._subscriptions.clear();
            instance._blockQueues.clear();
        });

        describe('create', () => {

            const baseQueueName = 'subscription-createSubscription';

            it('should create one if it does not exist', () => {

                const queueName = `${baseQueueName}-1`;
                const handlers = { event1 : () => {} };
                const options = {};

                const response = instance.create(queueName, handlers, options);
                const sut = instance._subscriptions.get(queueName);

                expect(response).to.be.true();
                expect(sut).to.exist();
                expect(sut.handlers).to.exist();
                expect(sut.handlers.event1).to.be.a.function();
                expect(sut.options).to.exist();
            });

            it('should not create one if it does exist', () => {

                const queueName = `${baseQueueName}-2`;
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                const response = instance.create(queueName, handlers, options);

                expect(response).to.be.false();
            });

            it('should subscribe to `subscription.created` event', async () => {

                return Promisify((done) => {

                    const queueName = `${baseQueueName}-3`;
                    const handlers = { event1 : () => {} };
                    const options = {};

                    instance.once(SubscriptionManager.CREATED_EVENT, (subcription) => {

                        expect(subcription).to.exist();
                        expect(subcription.handlers).to.exist();
                        expect(subcription.handlers.event1).to.be.a.function();
                        expect(subcription.options).to.exist();
                        done();
                    });

                    instance.create(queueName, handlers, options);
                });
            });
        });

        describe('tag', () => {

            const baseQueueName = 'subscription-tagSubscription';

            it('should return true when subscription exist', () => {

                const queueName = `${baseQueueName}-1`;
                const consumerTag = 'abcdefg012345';
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                const response = instance.tag(queueName, consumerTag);
                const sut = instance._subscriptions.get(queueName).hasOwnProperty('consumerTag');

                expect(response).to.be.true();
                expect(sut).to.be.true();
            });

            it('should return false when subscription does not exist', () => {

                const queueName = `${baseQueueName}-2`;
                const consumerTag = 'abcdefg012345';

                const response = instance.tag(queueName, consumerTag);

                expect(response).to.be.false();
            });

            it('should subscribe to `subscription.tagged` event', async () => {

                return Promisify((done) => {

                    const queueName = `${baseQueueName}-3`;
                    const consumerTag = 'abcdefg012345';
                    const handlers = { event1 : () => {} };
                    const options = {};

                    instance.once(SubscriptionManager.TAGGED_EVENT, (subcription) => {

                        expect(subcription).to.exist();
                        expect(subcription.consumerTag).to.be.equal(consumerTag);
                        expect(subcription.handlers).to.exist();
                        expect(subcription.handlers.event1).to.be.a.function();
                        expect(subcription.options).to.exist();
                        done();
                    });

                    instance.create(queueName, handlers, options);
                    instance.tag(queueName, consumerTag);
                });
            });
        });

        describe('get', () => {

            const baseQueueName = 'subscription-getSubscription';

            it('should return a subscription when it exist', () => {

                const queueName = `${baseQueueName}-1`;
                const consumerTag = 'abcdefg012345';
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                instance.tag(queueName, consumerTag);
                const sut = instance.get(queueName);

                expect(sut).to.exist();
                expect(sut.consumerTag).to.be.equal(consumerTag);
                expect(sut.handlers).to.exist();
                expect(sut.handlers.event1).to.be.a.function();
                expect(sut.options).to.exist();
            });

            it('should return undefined when it does not exist', () => {

                const queueName = `${baseQueueName}-2`;
                const sut = instance.get(queueName);

                expect(sut).to.be.undefined();
            });
        });

        describe('clear', () => {

            const baseQueueName = 'subscription-clearSubscription';

            it('should return true when subscription is cleared', () => {

                const queueName = `${baseQueueName}-1`;
                const consumerTag = 'abcdefg012345';
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                instance.tag(queueName, consumerTag);
                const response = instance.clear(queueName);
                const sut = instance._subscriptions.get(queueName).hasOwnProperty('consumerTag');

                expect(response).to.be.true();
                expect(sut).to.be.false();
            });

            it('should return false when subscription exist but does not have a consumerTag', () => {

                const queueName = `${baseQueueName}-2`;
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                const response = instance.clear(queueName);

                expect(response).to.be.false();
            });

            it('should return false when subscription does not exist', () => {

                const queueName = `${baseQueueName}-3`;

                const response = instance.clear(queueName);

                expect(response).to.be.false();
            });

            it('should subscribe to `subscription.cleared` event', async () => {

                return Promisify((done) => {

                    const queueName = `${baseQueueName}-4`;
                    const consumerTag = 'abcdefg012345';
                    const handlers = { event1 : () => {} };
                    const options = {};

                    instance.once(SubscriptionManager.CLEARED_EVENT, (subcription) => {

                        expect(subcription).to.exist();
                        done();
                    });

                    instance.create(queueName, handlers, options);
                    instance.tag(queueName, consumerTag);
                    instance.clear(queueName);
                });
            });
        });

        describe('clearAll', () => {

            const baseQueueName = 'subscription-clearAllSubscription';

            it('should return true when subscription is cleared', async () => {

                return Promisify((done) => {

                    const handlers = { event1 : () => {} };
                    const options = {};
                    const iterationLimit = 5;
                    let iterationCount = 0;

                    for (let i = 1; i <= iterationLimit; ++i) {
                        const queueName = `${baseQueueName}-${i}`;
                        const consumerTag = `abcdefg012345-${1}`;
                        instance.create(queueName, handlers, options);
                        instance.tag(queueName, consumerTag);
                    }

                    const eventHandler = (subscription) => {

                        ++iterationCount;

                        expect(subscription).to.exist();

                        if (iterationCount === iterationLimit) {
                            instance.removeListener(SubscriptionManager.CLEARED_EVENT, eventHandler);
                            done();
                        }
                    };

                    instance.on(SubscriptionManager.CLEARED_EVENT, eventHandler);
                    instance.clearAll();
                });
            });
        });

        describe('contains', () => {

            const baseQueueName = 'subscription-contains';

            it('should return false when subscription does not exist', () => {

                const queueName = `${baseQueueName}-1`;

                const response = instance.contains(queueName);

                expect(response).to.be.false();
            });

            it('should return true when subscription does exist', () => {

                const queueName = `${baseQueueName}-2`;
                const consumerTag = 'abcdefg012345';
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                instance.tag(queueName, consumerTag);
                const response = instance.contains(queueName);

                expect(response).to.be.true();
            });

            it('should return true when subscription does exist with removed consumerTag when using flag override', () => {

                const queueName = `${baseQueueName}-3`;
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                const response = instance.contains(queueName, false);

                expect(response).to.be.true();
            });
        });

        describe('remove', () => {

            const baseQueueName = 'subscription-removeSubscription';

            it('should return false when subscription does not exist', () => {

                const queueName = `${baseQueueName}-1`;

                const response = instance.remove(queueName);

                expect(response).to.be.false();
            });

            it('should return true when subscription exist', () => {

                const queueName = `${baseQueueName}-2`;
                const consumerTag = 'abcdefg012345';
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                instance.tag(queueName, consumerTag);
                const response = instance.remove(queueName);

                expect(response).to.be.true();
            });

            it('should return true when subscription exist with no consumerTag', () => {

                const queueName = `${baseQueueName}-2`;
                const handlers = { event1 : () => {} };
                const options = {};

                instance.create(queueName, handlers, options);
                const response = instance.remove(queueName);

                expect(response).to.be.true();
            });

            it('should subscribe to `subscription.removed` event', async () => {

                return Promisify((done) => {

                    const queueName = `${baseQueueName}-4`;
                    const handlers = { event1 : () => {} };
                    const options = {};

                    instance.once(SubscriptionManager.REMOVED_EVENT, (subscription) => {

                        expect(subscription).to.exist();
                        done();
                    });

                    instance.create(queueName, handlers, options);
                    instance.remove(queueName);
                });
            });
        });

        describe('list', () => {

            const baseQueueName = 'subscription-listSubscription';

            it('should return 3 records when 3 were added', () => {

                for (let i = 1; i <= 3; ++i) {
                    const queueName = `${baseQueueName}-${i}`;
                    const handlers = { event1 : () => {} };
                    const options = {};

                    instance.create(queueName, handlers, options);
                }

                const results = instance.list();

                expect(results).to.have.length(3);
            });
        });

        describe('block/unblock/isBlocked', () => {

            it('should be true when blocking queue is unique', () => {

                const queueName = 'queue1';

                const result = instance.block(queueName);

                expect(result).to.be.true();
            });

            it('should be false when blocking queue is not unique', () => {

                const queueName = 'queue2';

                instance.block(queueName);
                const result = instance.block(queueName);

                expect(result).to.be.false();
            });

            it('should be true when unblocking queue exist', () => {

                const queueName = 'queue3';

                instance.block(queueName);
                const result = instance.unblock(queueName);

                expect(result).to.be.true();
            });

            it('should be false when unblocking queue does not exist', () => {

                const queueName = 'queue4';

                const result = instance.unblock(queueName);

                expect(result).to.be.false();
            });

            it('should subscribe to `subscription.blocked` event', async () => {

                return Promisify((done) => {

                    const queueName = 'queue5';

                    instance.once(SubscriptionManager.BLOCKED_EVENT, (queue) => {

                        expect(queue).to.be.equal(queueName);
                        done();
                    });

                    instance.block(queueName);
                });
            });

            it('should subscribe to `subscription.unblocked` event', async () => {

                return Promisify((done) => {

                    const queueName = 'queue6';

                    instance.once(SubscriptionManager.UNBLOCKED_EVENT, (queue) => {

                        expect(queue).to.be.equal(queueName);
                        done();
                    });

                    instance.block(queueName);
                    instance.unblock(queueName);
                });
            });

            it('should be true when block queue exist', () => {

                const queueName = 'queue7';

                instance.block(queueName);
                const result = instance.isBlocked(queueName);

                expect(result).to.be.true();
            });

            it('should be false when block queue does not exist', () => {

                const queueName = 'queue8';

                const result = instance.isBlocked(queueName);

                expect(result).to.be.false();
            });
        });
    });
});
