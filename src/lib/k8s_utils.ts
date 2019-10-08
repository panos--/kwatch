import * as yaml from "js-yaml";
import { V1Secret } from "@kubernetes/client-node";

export class K8sUtils {
    public static decodeSecretData(secretData: V1Secret["data"]) {
        const decodedData: V1Secret["data"] = {};
        for (let key of Object.keys(secretData)) {
            decodedData[key] = Buffer.from(secretData[key], "base64").toString();
        }
        return decodedData;
    }

    public static dataToString(data: any) {
        return yaml.safeDump(data, {
            indent: 2,
            skipInvalid: true,
            sortKeys: true,
        });
    }

    public static regexAPIVersion = /^v(\d+)(?:([a-z]+)(\d+))?$/;

    public static compareAPIVersion(a: string, b: string) {
        const aMatches = K8sUtils.regexAPIVersion.exec(a);
        if (!aMatches) {
            throw "Invalid argument: a: not a valid version number";
        }
        const bMatches = K8sUtils.regexAPIVersion.exec(b);
        if (!bMatches) {
            throw "Invalid argument: a: not a valid version number";
        }

        const aMajor = parseInt(aMatches[1]);
        const aPreleaseName = aMatches[2];
        const aPreleaseNumber = parseInt(aMatches[3]);
        const bMajor = parseInt(bMatches[1]);
        const bPreleaseName = bMatches[2];
        const bPreleaseNumber = parseInt(bMatches[3]);

        if (aMajor < bMajor) {
            return -1;
        }
        if (aMajor > bMajor) {
            return 1;
        }

        if (aPreleaseName === undefined && bPreleaseName !== undefined) {
            return 1;
        }
        if (aPreleaseName !== undefined && bPreleaseName === undefined) {
            return -1;
        }
        if (aPreleaseName === undefined && bPreleaseName === undefined) {
            return 0;
        }

        if (aPreleaseName < bPreleaseName) {
            return -1;
        }
        if (aPreleaseName > bPreleaseName) {
            return 1;
        }

        if (aPreleaseNumber < bPreleaseNumber) {
            return -1;
        }
        if (aPreleaseNumber > bPreleaseNumber) {
            return 1;
        }

        return 0;
    }
}
