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
}
