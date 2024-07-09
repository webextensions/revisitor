const semver = require('semver');

const sortVersions = function (arrVersions) {
    const clonedArrVersions = structuredClone(arrVersions);
    return clonedArrVersions.sort((a, b) => {
        return semver.compare(a, b);
    });
};

const tagNodeVersions = async function () {
    // eslint-disable-next-line import/no-unresolved
    const { got } = await import('got');

    const nodeJsReleasesResponse = await got.get('https://nodejs.org/dist/index.json');

    const json = JSON.parse(nodeJsReleasesResponse.body);
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
