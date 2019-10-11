import * as request from "request";
import * as rp from "request-promise-native";
import * as childProcess from "child_process";
import async from "async";
import { V1APIGroup, V1APIResourceList, V1Namespace, V1Pod, V1Secret } from "@kubernetes/client-node";
import { KubeConfig, CoreV1Api, ApisApi } from "./vendor/kube_api";
import { APIResource } from "./api_resource";
import { ObjectSerializer } from "./vendor/object_serializer";
import { APIGroupResources } from "./api_group_resources";

export class K8sClient {
    private _kubeConfig: KubeConfig;
    private coreApi: CoreV1Api;

    public constructor(kubeConfig?: KubeConfig) {
        if (!kubeConfig) {
            kubeConfig = new KubeConfig();
            kubeConfig.loadFromDefault();
        }
        this.kubeConfig = kubeConfig;
    }

    public get kubeConfig(): KubeConfig {
        return this._kubeConfig;
    }

    public set kubeConfig(kubeConfig: KubeConfig) {
        this._kubeConfig = kubeConfig;
        this.coreApi = this._kubeConfig.makeApiClient(CoreV1Api);
    }

    private async request(endpoint: string) {
        let opts: request.Options = {
            url: `${this.kubeConfig.getCurrentCluster().server}${endpoint}`,
            json: true,
        };
        this.kubeConfig.applyToRequest(opts);
        try {
            return await rp.get(opts);
        } catch (e) {
            throw e;
        }
    }

    private async getListableExtensionAPIResources(group: V1APIGroup) {
        let result: APIResource[] = [];
        let apiGroupResources: APIGroupResources = new APIGroupResources(group);
        for (let versionObj of group.versions) {
            let body;
            try {
                body = await this.request(`/apis/${versionObj.groupVersion}`);
            } catch (e) {
                throw e;
            }
            let resourceList: V1APIResourceList = ObjectSerializer.deserialize(body, "V1APIResourceList");
            resourceList.resources
                .filter(r => r.verbs.find(verb => { return verb == "list"; }))
                .forEach(r => {
                    apiGroupResources.addResource(r, versionObj.version);
                });
        }
        for (let versionedResource of apiGroupResources.getNewestResources()) {
            result.push(new APIResource(versionedResource.resource, versionedResource.groupVersion, group));
        }
        return result;
    }

    public async getListableAPIResources() {
        let resources: APIResource[] = [];

        const coreApi = this.kubeConfig.makeApiClient(CoreV1Api);
        let coreApiRes;
        try {
            coreApiRes = await coreApi.getAPIResources();
        } catch (e) {
            throw e;
        }
        coreApiRes.body.resources
            .filter(r => r.verbs.find(verb => { return verb == "list"; }))
            .forEach((r) => {
                resources.push(new APIResource(r, "v1"));
            });

        let apisApiRes;
        try {
            const apisApi = this.kubeConfig.makeApiClient(ApisApi);
            apisApiRes = await apisApi.getAPIVersions();
        } catch (e) {
            throw e;
        }

        const self = this;
        let results;
        try {
            results = await (async.mapLimit(apisApiRes.body.groups, 10, async function (group, done) {
                let result = null;
                let error = null;
                try {
                    result = await self.getListableExtensionAPIResources(group);
                } catch (e) {
                    error = e;
                }
                done(error, result);
            }) as unknown as Promise<APIResource[][]>);
        }
        catch (e) {
            throw e;
        }

        for (const resByGroup of results) {
            for (const resource of resByGroup) {
                resources.push(resource);
            }
        }

        return resources;
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
            if (e.response) {
                throw e.response.statusMessage;
            }
            throw e;
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
            if (e.response) {
                throw e.response.statusMessage;
            }
            throw e;
        }

        return secret;
    }
}
