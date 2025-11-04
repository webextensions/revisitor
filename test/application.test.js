/* globals describe, it */

// If there would be an error in "import", the test would not even load/start
import { application } from '../server/application.ts'; // eslint-disable-line no-unused-vars

describe('Application', function () {
    it('should load /server/application.ts fine using require', function (done) {
        done();
    });
});
