import { V1Namespace, V1NamespaceList, V1Pod, V1Secret, V1APIResourceList, V1APIGroupList } from "@kubernetes/client-node";
import { KubeConfig, CoreV1Api, ApisApi } from "../vendor/kube_api";
import { K8sClient } from "../client";
import { mocked } from "ts-jest/utils";
import { IncomingMessage } from "http";
import { MaybeMocked } from "ts-jest/dist/util/testing";
import { APIResource } from "../api_resource";
import * as cpp from "../vendor/child_process_promise";

jest.mock("../vendor/kube_api");
jest.mock("../vendor/child_process_promise");

describe("config handling", () => {
    it("should load config by default", () => {
        const client = new K8sClient();
        expect(client.kubeConfig).toBeTruthy();
        const mockedConfig = mocked(client.kubeConfig);
        expect(mockedConfig.loadFromDefault).toHaveBeenCalled();
    });

    it("should use provided config", () => {
        const config = new KubeConfig();
        const client = new K8sClient(config);
        expect(client.kubeConfig).toBe(config);
        const config2 = new KubeConfig();
        client.kubeConfig = config2;
        expect(client.kubeConfig).toBe(config2);
    });
});

class ClientMock {
    public client: K8sClient;
    public config: KubeConfig;
    public mockedConfig: MaybeMocked<KubeConfig>;
    public api: CoreV1Api;
    public mockedApi: MaybeMocked<CoreV1Api>;

    public constructor() {
        this.api = new CoreV1Api();
        this.mockedApi = mocked(this.api);
        this.config = new KubeConfig();
        this.mockedConfig = mocked(this.config);
        this.mockedConfig.getCurrentCluster.mockReturnValue({
            name: "test-cluster",
            server: "https://server.invalid",
            skipTLSVerify: true,
        });
        this.mockedConfig.makeApiClient.mockReturnValue(this.api);
        this.client = new K8sClient(this.config);
    }
}

describe("get namespaces", () => {
    let clientMock: ClientMock;

    beforeEach(() => {
        clientMock = new ClientMock();
    });

    it("should pass empty result", async () => {
        clientMock.mockedApi.listNamespace.mockImplementationOnce(async () => {
            const msg = new IncomingMessage(null);
            const list = new V1NamespaceList();
            list.items = [];
            return {
                response: msg,
                body: list,
            };
        });
        const callback = jest.fn(() => {});
        await clientMock.client.getNamespaces(callback);
        expect(callback).toHaveBeenCalledWith(null, []);
    });

    it("should pass retrieved namespaces", async () => {
        const namespaces: V1Namespace[] = [
            { metadata: { name: "foons" } },
            { metadata: { name: "barns" } },
            { metadata: { name: "quxns" } },
        ];
        clientMock.mockedApi.listNamespace.mockImplementationOnce(async () => {
            const msg = new IncomingMessage(null);
            const list = new V1NamespaceList();
            list.items = namespaces;
            return {
                response: msg,
                body: list,
            };
        });
        const callback = jest.fn(() => {});
        await clientMock.client.getNamespaces(callback);
        expect(callback).toHaveBeenCalledWith(null, namespaces);
    });

    it("should pass error on failure", async () => {
        const error = new Error("test-error");
        clientMock.mockedApi.listNamespace.mockImplementationOnce(async () => {
            throw error;
        });
        const callback = jest.fn(() => {});
        await clientMock.client.getNamespaces(callback);
        expect(callback).toHaveBeenCalledWith(error);
    });
});

describe("get pods", () => {
    let clientMock: ClientMock;

    beforeEach(() => {
        clientMock = new ClientMock();
        clientMock.mockedApi.readNamespacedPod.mockImplementation(async (name, namespace) => {
            if (name == "known-pod" && namespace == "known-ns") {
                const response = new IncomingMessage(null);
                const body: V1Pod = {
                    metadata: {name: name, namespace: namespace}
                };
                return {
                    response: response,
                    body: body
                };
            }
            else if (name == "fail-connect") {
                throw new Error("connect failed");
            }
            else {
                throw {
                    response: { statusMessage: "Not Found" }
                };
            }
        });
    });

    it("should pass pod data", async () => {
        await expect(clientMock.client.getPod("known-pod", "known-ns"))
            .resolves.toEqual({ metadata: { name: "known-pod", namespace: "known-ns" }});
    });

    it("should throw on unknown pod", async () => {
        await expect(clientMock.client.getPod("unknown-pod", "known-ns"))
            .rejects.toEqual("Not Found");
    });

    it("should throw on unknown namespace", async () => {
        await expect(clientMock.client.getPod("known-pod", "unknown-ns"))
            .rejects.toEqual("Not Found");
    });

    it("should pass error on connection failures", async () => {
        await expect(clientMock.client.getPod("fail-connect", "known-ns"))
            .rejects.toEqual(new Error("connect failed"));
    });
});

describe("get secrets", () => {
    let clientMock: ClientMock;

    beforeEach(() => {
        clientMock = new ClientMock();
        clientMock.mockedApi.readNamespacedSecret.mockImplementation(async (name, namespace) => {
            if (name == "known-secret" && namespace == "known-ns") {
                const response = new IncomingMessage(null);
                const body: V1Secret = {
                    metadata: {name: name, namespace: namespace}
                };
                return {
                    response: response,
                    body: body
                };
            }
            else if (name == "fail-connect") {
                throw new Error("connect failed");
            }
            else {
                throw {
                    response: { statusMessage: "Not Found" }
                };
            }
        });
    });

    it("should pass secret data", async () => {
        await expect(clientMock.client.getSecret("known-secret", "known-ns"))
            .resolves.toEqual({ metadata: { name: "known-secret", namespace: "known-ns" }});
    });

    it("should throw on unknown secret", async () => {
        await expect(clientMock.client.getSecret("unknown-secret", "known-ns"))
            .rejects.toEqual("Not Found");
    });

    it("should throw on unknown namespace", async () => {
        await expect(clientMock.client.getSecret("known-secret", "unknown-ns"))
            .rejects.toEqual("Not Found");
    });

    it("should pass error on connection failures", async () => {
        await expect(clientMock.client.getSecret("fail-connect", "known-ns"))
            .rejects.toEqual(new Error("connect failed"));
    });
});

describe("get listable api resources", () => {
    let clientMock: ClientMock;

    let apiResourcesCommand: "empty"|"list"|"error" = "empty";
    let apiVersionsCommand: "empty"|"list"|"error" = "empty";

    beforeEach(() => {
        (require("request-promise-native") as any).__mockFail(false);

        apiResourcesCommand = "empty";
        apiVersionsCommand = "empty";

        clientMock = new ClientMock();
        clientMock.mockedConfig.makeApiClient.mockImplementation((apiClientType) => {
            const api = new apiClientType("server.test");
            if (api instanceof CoreV1Api) {
                mocked(api).getAPIResources.mockImplementation(async () => {
                    if (apiResourcesCommand == "error") {
                        throw new Error("apiresources-error");
                    }
                    let list: V1APIResourceList;
                    if (apiResourcesCommand == "empty") {
                        list = new V1APIResourceList();
                        list.resources = [];
                    }
                    else {
                        list = new V1APIResourceList();
                        list.resources = [
                            {
                                kind: "Foo",
                                name: "foos",
                                singularName: "",
                                namespaced: true,
                                verbs: ["list"]
                            },
                            {
                                kind: "Bar",
                                name: "bars",
                                singularName: "",
                                namespaced: true,
                                verbs: ["list"]
                            },
                            {
                                kind: "Qux",
                                name: "quxs",
                                singularName: "",
                                namespaced: true,
                                verbs: ["get"]
                            },
                            {
                                kind: "Baz",
                                name: "bazs",
                                singularName: "",
                                namespaced: true,
                                verbs: ["list"]
                            },
                        ];
                    }
                    const res = {
                        response: new IncomingMessage(null),
                        body: list,
                    };
                    return res;
                });
            }
            else if (api instanceof ApisApi) {
                mocked(api).getAPIVersions.mockImplementation(async () => {
                    if (apiVersionsCommand == "error") {
                        throw new Error("apiversions-error");
                    }
                    const list = new V1APIGroupList();
                    list.groups = apiVersionsCommand == "empty" ? [] : [
                        { name: "foogroup", versions: [
                            { groupVersion: "foogroup/v1", version: "v1" }
                        ] },
                        { name: "bargroup", versions: [
                            { groupVersion: "bargroup/v1", version: "v1" },
                            { groupVersion: "bargroup/v1alpha1", version: "v1alpha1" }
                        ] },
                    ];
                    const res = {
                        response: new IncomingMessage(null),
                        body: list,
                    };
                    return res;
                });
            }
            return api;
        });
    });

    it("should pass empty results", async () => {
        const resources = await clientMock.client.getListableAPIResources();
        expect(resources).toEqual([]);
    });

    it("should pass listable core resources", async () => {
        apiResourcesCommand = "list";
        const resources = await clientMock.client.getListableAPIResources();
        expect(resources).toHaveLength(3);
        expect(resources.map(r => r.resource.name)).toEqual(["foos", "bars", "bazs"]);
    });

    it("should pass errors from core resource request", async () => {
        apiResourcesCommand = "error";
        expect.assertions(1);
        try {
            await clientMock.client.getListableAPIResources();
        } catch (e) {
            expect(e).toEqual(new Error("apiresources-error"));
        }
    });

    it("should pass listable extension resources", async () => {
        apiVersionsCommand = "list";
        const resources = await clientMock.client.getListableAPIResources();
        expect(resources).toHaveLength(2);
        expect(resources.find(r => r.getFullName() == "foos.foogroup/v1")).toBeDefined();
        expect(resources.find(r => r.getFullName() == "bars.bargroup/v1")).toBeDefined();
    });

    it("shoud pass errors from api versions request", async () => {
        apiVersionsCommand = "error";
        expect.assertions(1);
        try {
            await clientMock.client.getListableAPIResources();
        } catch (e) {
            expect(e).toEqual(new Error("apiversions-error"));
        }
    });

    it("shoud pass errors from listable extension request", async () => {
        (require("request-promise-native") as any).__mockFail(true);
        apiVersionsCommand = "list";
        expect.assertions(1);
        try {
            await clientMock.client.getListableAPIResources();
        } catch (e) {
            expect(e).toEqual(new Error("request failed"));
        }
    });
});

describe("describe resource", () => {
    const client = new K8sClient();
    const namespace: V1Namespace = {
        metadata: { name: "default" }
    };
    const podsResource = new APIResource({
        kind: "Pod",
        name: "pods",
        singularName: "",
        namespaced: true,
        verbs: [],
    }, "v1");
    const resource = "test-pod";

    beforeEach(() => {
        (cpp.execFile as any).__mockFail = false;
    });

    it("should return description of resource", async () => {
        const outputLines = await client.describeResource(namespace, podsResource, resource);
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines[0]).toMatch(`Name:           ${resource}`);
        expect(outputLines.join("\n")).toMatch(`Namespace:      ${namespace.metadata.name}`);
    });

    it("should throw error on failure", async () => {
        (cpp.execFile as any).__mockFail = true;
        expect.assertions(1);
        try {
            await client.describeResource(namespace, podsResource, resource);
        } catch (e) {
            expect(e).toEqual(new Error(`${resource} failure`));
        }
    });
});

describe("get resource as yaml", () => {
    const client = new K8sClient();
    const namespace: V1Namespace = {
        metadata: { name: "default" }
    };
    const podsResource = new APIResource({
        kind: "Pod",
        name: "pods",
        singularName: "",
        namespaced: true,
        verbs: [],
    }, "v1");
    const resource = "test-pod";

    beforeEach(() => {
        (cpp.execFile as any).__mockFail = false;
    });

    it("should return yaml definition of resource", async () => {
        const outputLines = await client.getResourceAsYaml(namespace, podsResource, resource);
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines[0]).toMatch("apiVersion");
        expect(outputLines.join("\n")).toMatch(`name: ${resource}`);
    });

    it("should throw error on failure", async () => {
        (cpp.execFile as any).__mockFail = true;
        expect.assertions(1);
        try {
            await client.getResourceAsYaml(namespace, podsResource, resource);
        } catch (e) {
            expect(e).toEqual(new Error(`${resource} failure`));
        }
    });
});

describe("delete resource", () => {
    const client = new K8sClient();
    const namespace: V1Namespace = {
        metadata: { name: "default" }
    };
    const podsResource = new APIResource({
        kind: "Pod",
        name: "pods",
        singularName: "",
        namespaced: true,
        verbs: [],
    }, "v1");
    const resource = "test-pod";

    beforeEach(() => {
        (cpp.execFile as any).__mockFail = false;
    });

    it("should return success message", async () => {
        const outputLines = await client.deleteResource(namespace, podsResource, resource, false);
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines.join("\n")).toBe(`pod "${resource}" deleted`);
    });

    it("should throw error on failure", async () => {
        (cpp.execFile as any).__mockFail = true;
        expect.assertions(1);
        try {
            await client.deleteResource(namespace, podsResource, resource, false);
        } catch (e) {
            expect(e).toEqual(new Error(`delete ${resource} failure`));
        }
    });

    it("should return success message on force", async () => {
        const outputLines = await client.deleteResource(namespace, podsResource, resource, true);
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines.join("\n")).toBe(`pod "${resource}" force deleted`);
    });

    it("should throw error on failure on force", async () => {
        (cpp.execFile as any).__mockFail = true;
        expect.assertions(1);
        try {
            await client.deleteResource(namespace, podsResource, resource, true);
        } catch (e) {
            expect(e).toEqual(new Error(`force delete ${resource} failure`));
        }
    });
});

describe("list formatted resources", () => {
    const client = new K8sClient();
    const namespace = "default";
    const podsResource = "pods";

    beforeEach(() => {
        (cpp.execFile as any).__mockFail = false;
    });

    it("should return formatted resource list", async () => {
        const outputLines = await client.listResourcesFormatted(namespace, podsResource);
        expect(outputLines.length).toBeGreaterThan(0);
        expect(outputLines[0]).toMatch(/^NAME\s/);
        expect(outputLines[1]).toMatch(/^pod-0/);
        expect(outputLines[outputLines.length - 1]).not.toBe("");
    });

    it("should return message if no resources found", async () => {
        const outputLines = await client.listResourcesFormatted("empty-ns", podsResource);
        expect(outputLines.length).toBe(1);
        expect(outputLines[0]).toBe("No resources found in empty-ns namespace.");
        expect(outputLines[outputLines.length - 1]).not.toBe("");
    });

    it("should throw error on failure", async () => {
        (cpp.execFile as any).__mockFail = true;
        expect.assertions(1);
        try {
            await client.listResourcesFormatted(namespace, podsResource);
        } catch (e) {
            expect(e).toEqual(new Error("get pods failure"));
        }
    });
});
