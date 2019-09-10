import * as k8s from "@kubernetes/client-node";
import * as request from "request";
import * as rp from "request-promise-native";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

// import * as Api from "kubernetes-client";
import { V1APIGroup, V1APIResourceList, V1APIResource } from "@kubernetes/client-node";

// const Client = Api.Client1_13;
// const config = Api.config;
// const client = new Client({ config: config.fromKubeconfig() });

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

class APIResource {
    public group?: V1APIGroup;
    public groupVersion: string;
    public resource: V1APIResource;

    public constructor(resource: V1APIResource, groupVersion: string, group?: V1APIGroup) {
        this.resource = resource;
        this.group = group;
        this.groupVersion = groupVersion;
    }

    public getName() {
        let name = this.resource.name;
        if (this.group) {
            name += "." + this.group.name;
        }
        name += "/" + this.groupVersion;
        return name;
    }
}

class VersionedAPIResource {
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

    public getNewestResources(): any[] {
        let result: VersionedAPIResource[] = [];
        for (let versionedResources of Object.values(this.resources)) {
            let newestResource = versionedResources.sort((a, b): number => {
                return a.groupVersion.localeCompare(b.groupVersion);
            }).pop();
            result.push(newestResource);
        }
        return result;
    }
}

async function getExtensionAPIResources(group: V1APIGroup) {
    let result: APIResource[] = [];
    let apiGroupResources: APIGroupResources = new APIGroupResources(group);
    for (let versionObj of group.versions) {
        let opts: request.Options = {
            url: `${kc.getCurrentCluster().server}/apis/${versionObj.groupVersion}`,
            json: true,
        };
        kc.applyToRequest(opts);

        let body = await rp.get(opts);
        let resourceList: V1APIResourceList = ObjectSerializer.deserialize(body, "V1APIResourceList");
        resourceList.resources.filter(r => !r.name.includes("/")).forEach(r => {
            apiGroupResources.addResource(r, versionObj.version);
        });
    }
    for (let versionedResource of apiGroupResources.getNewestResources()) {
        // console.log(`${versionedResource.resource.name}.${group.name}`);
        result.push(new APIResource(versionedResource.resource, versionedResource.groupVersion, group));
    }
    return result;
}

async function getAPIResources() {
    let resources: APIResource[] = [];

    const coreApi = kc.makeApiClient(k8s.CoreV1Api);
    let coreApiRes = await coreApi.getAPIResources();
    coreApiRes.body.resources.filter(r => !r.name.includes("/")).forEach((r) => {
        resources.push(new APIResource(r, "v1"));
        // console.log(r.name);
    });

    const apisApi = kc.makeApiClient(k8s.ApisApi);
    let apisApiRes = await apisApi.getAPIVersions();
    for (let group of apisApiRes.body.groups) {
        for (let resource of await getExtensionAPIResources(group)) {
            resources.push(resource);
        }
    }

    for (let resource of resources) {
        console.log(resource.getName());
    }
}

getAPIResources();
