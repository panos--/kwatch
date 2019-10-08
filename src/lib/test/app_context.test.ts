import { AppState } from "../app_context";
import { APIResource } from "../api_resource";

describe("AppState", () => {
    it("should unserialize state", () => {
        const origState = new AppState();
        origState.namespace = {};
        origState.apiResource = new APIResource({
            kind: "Foo",
            name: "foos",
            singularName: "",
            namespaced: true,
            verbs: [],
        }, "v1");
        const serializedState = JSON.stringify(origState, null, 2);
        const unserializedState = JSON.parse(serializedState);
        expect(unserializedState.apiResource instanceof APIResource).toBe(false);
        AppState.unserialize(unserializedState);
        expect(unserializedState.apiResource instanceof APIResource).toBe(true);
    });

    it("should unserialize empty state", () => {
        const origState = new AppState();
        const serializedState = JSON.stringify(origState, null, 2);
        const unserializedState = JSON.parse(serializedState);
        expect(unserializedState.namespace).toBe(null);
        AppState.unserialize(unserializedState);
        expect(unserializedState.apiResource).toBe(null);
    });
});
