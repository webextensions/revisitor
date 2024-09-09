const semver = require('semver');

const sortVersions = function (arrVersions) {
    const clonedArrVersions = structuredClone(arrVersions);
    return clonedArrVersions.sort((a, b) => {
        return semver.compare(a, b);
    });
};

const tagNodeVersions = async function () {
    const { execa } = (await import('execa'));

    // Somehow, the network call via 'got' / 'ky' libraries are erroring out with 'ETIMEDOUT' error. The error is a bit
    // intermittent, but it happens almost all the time (error occurs in around 90% of the attempts). Attempted to
    // provide some headers, like: 'accept', 'connection', 'host', 'user-agent' etc, but, the error still occurred.
    const url = 'https://nodejs.org/dist/index.json';
    const nodeJsReleasesResponse = await execa('curl', [url]);

    const json = JSON.parse(nodeJsReleasesResponse.stdout);
    const arrVersions = json.map((entry) => {
        return entry.version;
    });
    const arrSortedVersions = sortVersions(arrVersions);
    const versionLatest = arrSortedVersions[arrSortedVersions.length - 1];

    const arrSortedStableVersions = arrSortedVersions.filter((version) => {
        const major = semver.major(version);
        if (major % 2 === 0) {
            return true;
        } else {
            return false;
        }
    });
    const versionStable = arrSortedStableVersions[arrSortedStableVersions.length - 1];
    const versionStableMajor = semver.major(versionStable);

    const arrSortedStableTilde1Versions = arrSortedStableVersions.filter((version) => {
        const major = semver.major(version);
        if (major === versionStableMajor) {
            return false;
        } else {
            return true;
        }
    });
    const versionStableTilde1 = arrSortedStableTilde1Versions[arrSortedStableTilde1Versions.length - 1];
    const versionStableTilde1Major = semver.major(versionStableTilde1);

    const arrSortedStableTilde2Versions = arrSortedStableTilde1Versions.filter((version) => {
        const major = semver.major(version);
        if (major === versionStableTilde1Major) {
            return false;
        } else {
            return true;
        }
    });
    const versionStableTilde2 = arrSortedStableTilde2Versions[arrSortedStableTilde2Versions.length - 1];

    const taggedVersions = {
        latest: versionLatest,
        stable: versionStable,
        stableTilde1: versionStableTilde1,
        stableTilde2: versionStableTilde2
    };

    return taggedVersions;
};

module.exports = { tagNodeVersions };
