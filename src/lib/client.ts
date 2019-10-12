import * as request from "request";
import * as rp from "request-promise-native";
import * as childProcess from "child_process";
import * as cpp from "./vendor/child_process_promise";
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

    public async listResourcesFormatted(namespace: string, apiResource: string) {
        const args = ["-n", namespace, "get", apiResource, "-o", "wide"];
        try {
            const { stdout } = await cpp.execFile("kubectl", args, { encoding: null });
            return stdout.toLocaleString().trimRight().split("\n");
        } catch (e) {
            throw e;
        }
    }

    public async describeResource(namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const args = ["-n", namespace.metadata.name, "describe", apiResource.resource.name, resource];
        try {
            const { stdout } = await cpp.execFile("kubectl", args, { encoding: null });
            return stdout.toLocaleString().split("\n");
        } catch (e) {
            throw e;
        }
    }

    public async getResourceAsYaml(namespace: V1Namespace, apiResource: APIResource, resource: string) {
        const args = ["-n", namespace.metadata.name, "get", apiResource.resource.name, resource, "-o", "yaml"];
        try {
            const { stdout } = await cpp.execFile("kubectl", args, { encoding: null });
            return stdout.toLocaleString().split("\n");
        } catch (e) {
            throw e;
        }
    }

    public async deleteResource(namespace: V1Namespace, apiResource: APIResource, resource: string, force: boolean) {
        let args = ["-n", namespace.metadata.name, "delete"];
        if (force) {
            args.push("--force", "--grace-period=0");
        }
        args.push(apiResource.resource.name, resource);

        try {
            const { stdout } = await cpp.execFile("kubectl", args, { encoding: null });
            return stdout.toLocaleString().split("\n");
        } catch (e) {
            throw e;
        };
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
