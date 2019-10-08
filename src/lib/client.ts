import * as k8s from "@kubernetes/client-node";
import * as request from "request";
import * as rp from "request-promise-native";
import * as childProcess from "child_process";
import async from "async";
import { V1APIGroup, V1APIResourceList, V1APIResource, CoreV1Api, V1Namespace, V1Pod, V1Secret } from "@kubernetes/client-node";
import { APIResource } from "./api_resource";

let primitives = [
    "string",
    "boolean",
    "double",
    "integer",
    "long",
    "float",
    "number",
    "any"
];
let enumsMap: {[index: string]: any} = {};
let typeMap: {[index: string]: any} = {
    "V1APIResource": k8s.V1APIResource,
    "V1APIResourceList": k8s.V1APIResourceList,
};
class ObjectSerializer {
    public static findCorrectType(data: any, expectedType: any) {
        if (data == undefined) {
            return expectedType;
        }
        else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
            return expectedType;
        }
        else if (expectedType === "Date") {
            return expectedType;
        }
        else {
            if (enumsMap[expectedType]) {
                return expectedType;
            }
            if (!typeMap[expectedType]) {
                return expectedType; // w/e we don't know the type
            }
            // Check the discriminator
            let discriminatorProperty = typeMap[expectedType].discriminator;
            if (discriminatorProperty == null) {
                return expectedType; // the type does not have a discriminator. use it.
            }
            else {
                if (data[discriminatorProperty]) {
                    return data[discriminatorProperty]; // use the type given in the discriminator
                }
                else {
                    return expectedType; // discriminator was not present (or an empty string)
                }
            }
        }
    }
    public static serialize(data: any, type: any): any {
        if (data == undefined) {
            return data;
        }
        else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        }
        else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.serialize(date, subType));
            }
            return transformedData;
        }
        else if (type === "Date") {
            return data.toString();
        }
        else {
            if (enumsMap[type]) {
                return data;
            }
            if (!typeMap[type]) { // in case we dont know the type
                return data;
            }
            // get the map for the correct type.
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            let instance: {[index: string]: any} = {};
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
            }
            return instance;
        }
    }
    public static deserialize(data: any, type: any): any {
        // polymorphism may change the actual type.
        type = ObjectSerializer.findCorrectType(data, type);
        if (data == undefined) {
            return data;
        }
        else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        }
        else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.deserialize(date, subType));
            }
            return transformedData;
        }
        else if (type === "Date") {
            return new Date(data);
        }
        else {
            if (enumsMap[type]) { // is Enum
                return data;
            }
            if (!typeMap[type]) { // dont know the type
                return data;
            }
            let instance = new typeMap[type]();
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
            }
            return instance;
        }
    }
}

export class VersionedAPIResource {
    public resource: V1APIResource;
    public groupVersion: string;
    public constructor(resource: V1APIResource, groupVersion: string) {
        this.resource = resource;
        this.groupVersion = groupVersion;
    }
}

class APIGroupResources {
    public group: V1APIGroup;
    public resources: {[index: string]: VersionedAPIResource[]};

    public constructor(group: V1APIGroup) {
        this.group = group;
        this.resources = {};
    }

    public addResource(resource: V1APIResource, groupVersion: string) {
        if (!this.resources.hasOwnProperty(resource.name)) {
            this.resources[resource.name] = [];
        }
        this.resources[resource.name].push(new VersionedAPIResource(resource, groupVersion));
    }

    public getNewestResources(): VersionedAPIResource[] {
        let result: VersionedAPIResource[] = [];
        for (let versionedResources of Object.values(this.resources)) {
            // FIXME: doesn't work (i.e. v1 < v1alpha1)
            let newestResource = versionedResources.sort((a, b): number => {
                return a.groupVersion.localeCompare(b.groupVersion);
            }).pop();
            result.push(newestResource);
        }
        return result;
    }
}

export class K8sClient {
    private _kubeConfig: k8s.KubeConfig;
    private coreApi: CoreV1Api;

    public constructor(kubeConfig?: k8s.KubeConfig) {
        if (!kubeConfig) {
            kubeConfig = new k8s.KubeConfig();
            kubeConfig.loadFromDefault();
        }
        this.kubeConfig = kubeConfig;
    }

    public get kubeConfig(): k8s.KubeConfig {
        return this._kubeConfig;
    }

    public set kubeConfig(kubeConfig: k8s.KubeConfig) {
        this._kubeConfig = kubeConfig;
        this.coreApi = this._kubeConfig.makeApiClient(k8s.CoreV1Api);
    }

    private async request(endpoint: string) {
        let opts: request.Options = {
            url: `${this.kubeConfig.getCurrentCluster().server}${endpoint}`,
            json: true,
        };
        this.kubeConfig.applyToRequest(opts);
        return rp.get(opts);
    }

    private async getListableExtensionAPIResources(group: V1APIGroup) {
        let result: APIResource[] = [];
        let apiGroupResources: APIGroupResources = new APIGroupResources(group);
        for (let versionObj of group.versions) {
            let body = await this.request(`/apis/${versionObj.groupVersion}`);
            let resourceList: V1APIResourceList = ObjectSerializer.deserialize(body, "V1APIResourceList");
            resourceList.resources
                .filter(r => r.verbs.find(verb => { return verb == "list"; }))
                .forEach(r => {
                    apiGroupResources.addResource(r, versionObj.version);
                });
        }
        for (let versionedResource of apiGroupResources.getNewestResources()) {
            // console.log(`${versionedResource.resource.name}.${group.name}`);
            result.push(new APIResource(versionedResource.resource, versionedResource.groupVersion, group));
        }
        return result;
    }

    public async getListableAPIResources(cb: (error?: Error, resources?: APIResource[]) => void) {
        let resources: APIResource[] = [];

        const coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
        let coreApiRes;
        try {
            coreApiRes = await coreApi.getAPIResources();
        } catch (e) {
            cb(e);
            return;
        }
        if (coreApiRes) {
            coreApiRes.body.resources
                .filter(r => r.verbs.find(verb => { return verb == "list"; }))
                .forEach((r) => {
                    resources.push(new APIResource(r, "v1"));
                });
        }

        let apisApiRes;
        try {
            const apisApi = this.kubeConfig.makeApiClient(k8s.ApisApi);
            apisApiRes = await apisApi.getAPIVersions();
        } catch (e) {
            cb(e);
            null;
        }

        const self = this;
        async.mapLimit(apisApiRes.body.groups, 10, async function (group, done) {
            let result = null;
            let error = null;
            try {
                result = await self.getListableExtensionAPIResources(group);
            } catch (e) {
                error = e;
            }
            done(error, result);
        },
        (err, results: APIResource[][]) => {
            if (err) {
                cb(err, null);
                return;
            }
            for (const resByGroup of results) {
                for (const resource of resByGroup) {
                    resources.push(resource);
                }
            }
            cb(null, resources);
        });
    }

    public async getNamespaces(cb: (error?: Error, namespaces?: V1Namespace[]) => void) {
        let res;
        try {
            res = await this.coreApi.listNamespace();
        } catch (e) {
            cb(e);
            return;
        }
        let namespaces: V1Namespace[] = [];
        for (const item of res.body.items) {
            namespaces.push(item);
        }
        cb(null, namespaces);
    }

    public async listResourcesFormatted(namespace: string | null, apiResources: string[], cb: (error: Error, lines: any[]) => void) {
        if (namespace !== null && namespace.length == 0) {
            throw "invalid argument: namespace must not be empty";
        }

        if (apiResources.length == 0) {
            throw "invalid argument: apiResources must not be empty";
        }
        for (let apiResource of apiResources) {
            if (apiResource.trim().length == 0) {
                throw "invalid argument: apiResources must not contain empty strings";
            }
        }

        let args = [];
        if (namespace !== null) {
            args.push("-n", namespace);
        }
        args.push("get", apiResources.join(","), "-o", "wide");

        childProcess.execFile("kubectl", args, {
            encoding: null,
        }, (error, stdout) => {
            cb(error, stdout.toLocaleString().trimRight().split("\n"));
        });
    }

    public async describeResource(
        namespace: V1Namespace | null,
        apiResource: APIResource,
        resource: string,
        cb: (error: Error, lines: any[]) => void) {

        let args = [];
        if (namespace !== null) {
            args.push("-n", namespace.metadata.name);
        }
        args.push("describe", apiResource.resource.name, resource);

        childProcess.execFile("kubectl", args, {
            encoding: null,
        }, (error, stdout) => {
            cb(error, stdout.toLocaleString().split("\n"));
        });
    }

    public async getResourceAsYaml(
        namespace: V1Namespace | null,
        apiResource: APIResource,
        resource: string,
        cb: (error: Error, lines: any[]) => void) {

        let args = [];
        if (namespace !== null) {
            args.push("-n", namespace.metadata.name);
        }
        args.push("get", apiResource.resource.name, resource, "-o", "yaml");

        childProcess.execFile("kubectl", args, {
            encoding: null,
        }, (error, stdout) => {
            cb(error, stdout.toLocaleString().split("\n"));
        });
    }

    public async deleteResource(
        namespace: V1Namespace | null,
        apiResource: APIResource,
        resource: string,
        force: boolean,
        cb: (error: Error) => void) {

        let args = [];
        if (namespace !== null) {
            args.push("-n", namespace.metadata.name);
        }
        args.push("delete");
        if (force) {
            args.push("--force", "--grace-period=0");
        }
        args.push(apiResource.resource.name, resource);

        childProcess.execFile("kubectl", args, {
            encoding: null,
        }, (error) => {
            cb(error);
        });
    }

    public async getPod(podName: string, namespaceName: string) {
        const client = this.kubeConfig.makeApiClient(CoreV1Api);

        let pod: V1Pod;
        try {
            const res = await client.readNamespacedPod(podName, namespaceName);
            pod = res.body;
        } catch (e) {
            throw e.response.statusMessage;
        }

        return pod;
    }

    public async getSecret(secretName: string, namespaceName: string) {
        const client = this.kubeConfig.makeApiClient(CoreV1Api);

        let secret: V1Secret;
        try {
            const res = await client.readNamespacedSecret(secretName, namespaceName);
            secret = res.body;
        } catch (e) {
            throw e.response.statusMessage;
        }

        return secret;
    }
}
