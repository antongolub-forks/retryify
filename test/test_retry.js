'use strict';

var assert = require('assert');
var util = require('util');
var Promise = require('bluebird');
var retryLib = require('../index');

suite('Retryify', function() {

  var retryify;

  suiteSetup(function() {
    // low timeout for faster tests
    retryify = retryLib({
      retries: 2,
      timeout: 5, // ms
      factor: 1.5,
    });

    // MUST GET 100% COVERAGE (ノ._.)ノ
    retryLib();
  });

  test('no times, synchronous fn', function() {
    var addABC = retryify(function(a, b, c) {
      return a + b + c;
    }, { retries: 0 });

    return addABC(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('once, error on first call, synchronous fn', function() {
    var retries = 1;

    var addFail = retryify(function(a, b, c) {
      if (retries > 0) {
        retries -= 1;
        throw new Error('Oh no! The promise failed :0');
      } else {
        return a + b + c;
      }
    }, { retries: retries });

    return addFail(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('twice, error on first and second call, synchronous fn', function() {
    var retries = 2;

    var addFail = retryify(function(a, b, c) {
      if (retries > 0) {
        retries -= 1;
        throw new Error('Fail!');
      } else {
        return a + b + c;
      }
    }, { retries: retries });

    return addFail(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('always error, synchronous fn', function() {
    var retries = 2;

    var fail = retryify(function() {
      throw new Error('Fail!');
    }, { retries: retries });

    return fail().then(function() {
      throw new Error('Promise should not resolve.');
    }).catch(Error, function(err) {
      // should not clean error message
      assert.equal(err.message, 'Fail!');
    });
  });

  test('no times, promise fn', function() {
    var addABC = retryify(function(a, b, c) {
      return Promise.delay(5).then(function() {
        return a + b + c;
      });
    }, { retries: 0 });

    return addABC(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('once, error on first call, promise fn', function() {
    var retries = 1;

    var addFail = retryify(function(a, b, c) {
      return Promise.delay(5).then(function() {
        if (retries > 0) {
          retries -= 1;
          throw new Error('Oh no! The promise failed :0');
        } else {
          return a + b + c;
        }
      });
    }, { retries: retries });

    return addFail(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('twice, error on first call, promise fn', function() {
    var retries = 2;

    var addFail = retryify(function(a, b, c) {
      return Promise.delay(5).then(function() {
        if (retries > 0) {
          retries -= 1;
          throw new Error('Oh no! The promise failed :0');
        } else {
          return a + b + c;
        }
      });
    }, { retries: retries });

    return addFail(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('always error, promise fn', function() {
    var retries = 2;

    var fail = retryify(function() {
      return Promise.delay(5).then(function() {
        throw new Error('Fail!');
      });
    }, { retries: retries });

    return fail().then(function() {
      throw new Error('Promise should not resolve.');
    }).catch(Error, function(err) {
      // should not clean error message
      assert.equal(err.message, 'Fail!');
    });
  });

  test('retries but never error, promise fn', function() {
    var addABC = retryify(function(a, b, c) {
      return Promise.delay(5).then(function() {
        return a + b + c;
      });
    }, { retries: 3 });

    return addABC(1, 2, 3).then(function(sum) {
      assert.equal(sum, 6);
    });
  });

  test('synchronous fn with `this` bound', function() {
    function Foo() {
      this.foo = 'this is a foo';
    }

    Foo.prototype.fooer = retryify(function(a, b, c) {
      assert.equal(this.foo, 'this is a foo');
      return [this.foo, a, b, c].join(' ');
    });

    var aFoo = new Foo();

    return aFoo.fooer(1, 2, 3).then(function(foo) {
      assert.equal(foo, 'this is a foo 1 2 3');
    });
  });

  test('promise fn with `this` bound', function() {
    function Foo() {
      this.foo = 'this is a foo';
    }

    Foo.prototype.fooer = retryify(function(a, b, c) {
      assert.equal(this.foo, 'this is a foo');
      return Promise.delay(5).bind(this).then(function() {
        return [this.foo, a, b, c].join(' ');
      });
    });

    var aFoo = new Foo();

    return aFoo.fooer(1, 2, 3).then(function(foo) {
      assert.equal(foo, 'this is a foo 1 2 3');
    });
  });

  test('error doesn\'t match user defined error', function() {
    function FooError() {
      this.name = 'FooError';
      this.message = 'This is a FooError';
    }
    util.inherits(FooError, Error);

    function BarError() {
      this.name = 'BarError';
      this.message = 'This is a BarError';
    }
    util.inherits(BarError, Error);

    function BazError() {
      this.name = 'BazError';
      this.message = 'This is a BazError';
    }
    util.inherits(BazError, Error);

    var count = 0;

    var fail = retryify({
      errors: [BarError, BazError],
    }, function() {
      return Promise.delay(5).then(function() {
        count += 1;
        throw new FooError();
      });
    });

    return fail().then(function() {
      assert(false, 'Should not resolve');
    }).catch(BarError, function() {
      assert(false, 'Should not catch a BarError');
    }).catch(BazError, function() {
      assert(false, 'Should not catch a BazError');
    }).catch(FooError, function() {
      assert.equal(count, 1);
    });
  });

  test('log should get called on retry', function() {
    var wasCalled = false;

    var mockLog = function() {
      wasCalled = true;
    };

    var fail = retryify({
      log: mockLog,
    }, function() {
      return Promise.delay(5).then(function() {
        throw new Error();
      });
    });

    assert(!wasCalled, 'mockLog should not be called at this point.');

    return fail().then(function() {
      assert(false, 'Should not resolve');
    }).catch(function() {
      assert(wasCalled, 'mockLog should get called at some point.');
    });
  });

});
