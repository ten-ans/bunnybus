'use strict';

module.exports = {
    ssl                : false,
    user               : 'guest',
    password           : 'guest',
    server             : 'rabbitmq',
    port               : 5672,
    vhost              : '%2f',
    heartbeat          : 2000,
    autoAcknowledgement: false,
    globalExchange     : 'default-exchange',
    limit              : 5,
    errorQueue         : 'error-bus',
    silence            : false
};