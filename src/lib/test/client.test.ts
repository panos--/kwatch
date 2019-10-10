import { KubeConfig, V1Namespace, CoreV1Api, V1NamespaceList, ApiType, V1Pod, V1Secret } from "@kubernetes/client-node";
import { K8sClient } from "../client";
import { mocked } from "ts-jest/utils";
import { IncomingMessage } from "http";
import { MaybeMocked } from "ts-jest/dist/util/testing";

jest.mock("@kubernetes/client-node");

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

class ClientMock<T extends ApiType> {
    public client: K8sClient;
    public config: KubeConfig;
    public mockedConfig: MaybeMocked<KubeConfig>;
    public api: T;
    public mockedApi: MaybeMocked<T>;

    public constructor(ctor: new () => T) {
        this.api = new ctor();
        this.mockedApi = mocked(this.api);
        this.config = new KubeConfig();
        this.mockedConfig = mocked(this.config);
        this.mockedConfig.makeApiClient.mockReturnValue(this.api);
        this.client = new K8sClient(this.config);
    }
}

describe("get namespaces", () => {
    let clientMock: ClientMock<CoreV1Api>;

    beforeEach(() => {
        clientMock = new ClientMock<CoreV1Api>(CoreV1Api);
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
    let clientMock: ClientMock<CoreV1Api>;

    beforeEach(() => {
        clientMock = new ClientMock<CoreV1Api>(CoreV1Api);
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
    let clientMock: ClientMock<CoreV1Api>;

    beforeEach(() => {
        clientMock = new ClientMock<CoreV1Api>(CoreV1Api);
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
