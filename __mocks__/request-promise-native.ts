import { V1APIResourceList } from "@kubernetes/client-node/dist/api";

const rp = jest.genMockFromModule("request-promise-native");

let mockFail = false;

function __mockFail(fail: boolean) {
    mockFail = fail;
}

async function get(options: any) {
    if (mockFail) {
        throw new Error("request failed");
    }
    if (!options.url) {
        return;
    }
    if (options.url.endsWith("/apis/foogroup/v1")) {
        const result: V1APIResourceList = {
            groupVersion: "foogroup/v1",
            resources: [{
                kind: "Foo",
                name: "foos",
                singularName: "",
                namespaced: true,
                verbs: ["get", "list"],
            }]
        };
        return result;
    }
    if (options.url.endsWith("/apis/bargroup/v1")) {
        const result: V1APIResourceList = {
            groupVersion: "bargroup/v1",
            resources: [{
                kind: "Bar",
                name: "bars",
                singularName: "",
                namespaced: true,
                verbs: ["get", "list"],
            }]
        };
        return result;
    }
    if (options.url.endsWith("/apis/bargroup/v1alpha1")) {
        const result: V1APIResourceList = {
            groupVersion: "bargroup/v1alpha1",
            resources: [{
                kind: "Bar",
                name: "bars",
                singularName: "",
                namespaced: true,
                verbs: ["get", "list"],
            }]
        };
        return result;
    }
    return {};
}

(rp as any).__mockFail = __mockFail;
(rp as any).get = get;

module.exports = rp;
