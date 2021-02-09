'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const { PartitionSerialDispatcher } = require('../../../lib/schedulers');

const { describe, beforeEach, it } = (exports.lab = Lab.script());
const expect = Code.expect;

describe('schedulers', () => {
    describe('Partition Serial Dispatcher', () => {
        let instance = undefined;
        let payload = undefined;
        const queueName = 'test-partition-serial-dispatch-queue';

        describe('with no partition keys defined', () => {
            beforeEach(async () => {
                instance = new PartitionSerialDispatcher();
            });

            describe('constructor', () => {
                it('should default partitionKeySelectors to an empty array', async () => {
                    expect(instance.serialDispatchPartitionKeySelectors).to.be.an.array().to.have.length(0);
                });
            });

            describe('push', () => {
                const defaultQueueName = `${queueName}:default`;

                it('should add a new function to the default queue and execute', async () => {
                    let delegate = null;

                    const promise = new Promise((resolve) => {
                        delegate = resolve;
                    });

                    instance.push(queueName, delegate);

                    const sut = instance._queues.get(defaultQueueName);

                    await promise;

                    expect(sut).to.exist().and.to.be.an.object();
                });

                it('should add 3 functions to the default queue and execute', async () => {
                    let counter = 0;

                    await new Promise((resolve) => {
                        const delegate = async () => {
                            if (++counter === 3) {
                                resolve();
                            }
                        };

                        instance.push(queueName, delegate);
                        instance.push(queueName, delegate);
                        instance.push(queueName, delegate);
                    });

                    expect(counter).to.equal(3);
                });

                it('should add 50 functions and execute them in the order they were added', { timeout: 20000 }, async () => {
                    const target = 50;
                    let counter = 0;
                    const randomNumber = (min = 20, max = 250) => Math.floor(Math.random() * (max - min + 1) + min);

                    await new Promise((resolve, reject) => {
                        const delegate = async function (orderNumber) {
                            const waitTimeInMs = randomNumber();

                            // we add this timeout to force indeterministic behavior for function
                            // invokers that do not correctly handle asynchronous functions.
                            await new Promise((handlerResolve) => setTimeout(handlerResolve, waitTimeInMs));

                            if (counter !== orderNumber) {
                                reject(new Error('Messages are out of order'));
                            } else if (counter === target - 1 && counter === orderNumber) {
                                ++counter;
                                resolve();
                            } else {
                                ++counter;
                            }
                        };

                        for (let i = 0; i < target; ++i) {
                            // eslint-disable-next-line no-loop-func
                            ((orderNumber) => {
                                instance.push(queueName, delegate.bind(null, orderNumber));
                            })(i);
                        }
                    });

                    await new Promise((resolve) => setImmediate(resolve));

                    expect(counter).to.equal(target);
                    expect(instance._queues.size).to.equal(0);
                });

                it('should not concurrently call handlers in the dispatch queue when messages are sequentially enqueued', async () => {
                    let lock = false;
                    let counter = 0;

                    await new Promise((resolve, reject) => {
                        const delegate = async () => {
                            if (lock) {
                                reject('Messages are not processed serially');
                            }

                            lock = true;

                            await new Promise((timeoutResolve) => {
                                setTimeout(() => {
                                    lock = false;

                                    if (++counter === 2) {
                                        resolve();
                                    }

                                    timeoutResolve();
                                }, 500);
                            });
                        };

                        instance.push(queueName, delegate);
                        instance.push(queueName, delegate);
                    });

                    expect(counter).to.equal(2);
                });

                it('should not concurrently call handlers in the dispatch queue when messages are concurrently enqueued', async () => {
                    let lock = false;
                    let counter = 0;

                    await new Promise((resolve, reject) => {
                        const delegate = async () => {
                            instance.push(queueName, delegate);

                            if (lock) {
                                reject('Messages are not processed serially');
                            }

                            lock = true;

                            await new Promise((timeoutResolve) => {
                                setTimeout(() => {
                                    lock = false;

                                    if (++counter === 2) {
                                        resolve();
                                    }

                                    timeoutResolve();
                                }, 500);
                            });
                        };

                        instance.push(queueName, delegate);
                    });

                    expect(counter).to.equal(2);
                });
            });
        });

        describe.only('with one partition key defined', () => {
            const paritionKeySelector = '{message.serialNumber}';

            beforeEach(async () => {
                instance = new PartitionSerialDispatcher({ serialDispatchPartitionKeySelectors: [paritionKeySelector] });
            });

            describe('constructor', () => {
                it('should have one entry in the partitionKeySelectors array', async () => {
                    expect(instance.serialDispatchPartitionKeySelectors).to.be.an.array().to.have.length(1);
                });
            });

            describe('when key matches', () => {
                beforeEach(async () => {
                    payload = { message: { serialNumber: '8032060121' } };
                });

                describe('push', () => {
                    const partitionQueueName = `${queueName}:8032060121`;
                    const defaultQueueName = `${queueName}:default`;

                    it('should add a new function to the partitioned queue and execute', async () => {
                        let delegate = null;

                        const promise = new Promise((resolve) => {
                            delegate = resolve;
                        });

                        instance.push(queueName, delegate, payload);

                        const sut1 = instance._queues.get(partitionQueueName);
                        const sut2 = instance._queues.get(defaultQueueName);

                        await promise;

                        expect(sut1).to.exist().and.to.be.an.object();
                        expect(sut2).to.be.undefined();
                    });

                    it('should add 3 functions to the queue and execute', async () => {
                        let counter = 0;

                        await new Promise((resolve) => {
                            const delegate = async () => {
                                if (++counter === 3) {
                                    resolve();
                                }
                            };

                            instance.push(queueName, delegate, payload);
                            instance.push(queueName, delegate, payload);
                            instance.push(queueName, delegate, payload);
                        });

                        expect(counter).to.equal(3);
                    });

                    it('should add 50 functions and execute them in the order they were added', { timeout: 20000 }, async () => {
                        const target = 50;
                        let counter = 0;
                        const randomNumber = (min = 20, max = 250) => Math.floor(Math.random() * (max - min + 1) + min);

                        await new Promise((resolve, reject) => {
                            const delegate = async function (orderNumber) {
                                const waitTimeInMs = randomNumber();

                                // we add this timeout to force indeterministic behavior for function
                                // invokers that do not correctly handle asynchronous functions.
                                await new Promise((handlerResolve) => setTimeout(handlerResolve, waitTimeInMs));

                                if (counter !== orderNumber) {
                                    reject(new Error('Messages are out of order'));
                                } else if (counter === target - 1 && counter === orderNumber) {
                                    counter++;
                                    resolve();
                                } else {
                                    counter++;
                                }
                            };

                            for (let i = 0; i < target; ++i) {
                                // eslint-disable-next-line no-loop-func
                                ((orderNumber) => {
                                    instance.push(queueName, delegate.bind(null, orderNumber), payload);
                                })(i);
                            }
                        });

                        await new Promise((resolve) => setImmediate(resolve));

                        expect(counter).to.equal(target);
                        expect(instance._queues.size).to.equal(0);
                    });

                    it(
                        'should add 100 functions and execute them in the order they were added for each partition',
                        { timeout: 20000 },
                        async () => {
                            const target = 20;
                            const partitionCount = 5;

                            const counters = [];

                            const randomNumber = (min = 20, max = 250) => Math.floor(Math.random() * (max - min + 1) + min);

                            await new Promise((resolve, reject) => {
                                const delegate = async function (partition, orderNumber) {
                                    const waitTimeInMs = randomNumber();

                                    // we add this timeout to force indeterministic behavior for function
                                    // invokers that do not correctly handle asynchronous functions.
                                    await new Promise((handlerResolve) => setTimeout(handlerResolve, waitTimeInMs));

                                    if (counters[partition] !== orderNumber) {
                                        reject(new Error('Messages are out of order'));
                                    } else if (counters.every((counter) => counter >= target - 1) && counters[partition] === orderNumber) {
                                        ++counters[partition];
                                        resolve();
                                    } else {
                                        ++counters[partition];
                                    }
                                };

                                for (let i = 0; i < partitionCount; ++i) {
                                    counters[i] = 0;

                                    for (let j = 0; j < target; ++j) {
                                        // eslint-disable-next-line no-loop-func
                                        ((partition, orderNumber) => {
                                            instance.push(queueName, delegate.bind(null, partition, orderNumber), {
                                                message: { serialNumber: partition }
                                            });
                                        })(i, j);
                                    }
                                }

                                expect(instance._queues.size).to.equal(partitionCount);
                            });

                            await new Promise((resolve) => setImmediate(resolve));

                            for (let i = 0; i < partitionCount; ++i) {
                                expect(counters[i]).to.equal(target);
                            }

                            expect(instance._queues.size).to.equal(0);
                        }
                    );

                    it('should not concurrently call handlers in the dispatch queue when messages are sequentially enqueued', async () => {
                        let lock = false;
                        let counter = 0;

                        await new Promise((resolve, reject) => {
                            const delegate = async () => {
                                if (lock) {
                                    reject('Messages are not processed serially');
                                }

                                lock = true;

                                await new Promise((timeoutResolve) => {
                                    setTimeout(() => {
                                        lock = false;

                                        if (++counter === 2) {
                                            resolve();
                                        }

                                        timeoutResolve();
                                    }, 500);
                                });
                            };

                            instance.push(queueName, delegate, payload);
                            instance.push(queueName, delegate, payload);
                        });

                        expect(counter).to.equal(2);
                    });

                    it('should not concurrently call handlers in the dispatch queue when messages are concurrently enqueued', async () => {
                        let lock = false;
                        let counter = 0;

                        await new Promise((resolve, reject) => {
                            const delegate = async () => {
                                instance.push(queueName, delegate, payload);

                                if (lock) {
                                    reject('Messages are not processed serially');
                                }

                                lock = true;

                                await new Promise((timeoutResolve) => {
                                    setTimeout(() => {
                                        lock = false;

                                        if (++counter === 2) {
                                            resolve();
                                        }

                                        timeoutResolve();
                                    }, 500);
                                });
                            };

                            instance.push(queueName, delegate, payload);
                        });

                        expect(counter).to.equal(2);
                    });
                });
            });
        });
    });
});
