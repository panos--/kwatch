import { VersionedAPIResource } from "../versioned_api_resource";
import { V1APIResource } from "@kubernetes/client-node";

describe("VersionedAPIResource", () => {
    it("should construct correctly", () => {
        const r: V1APIResource = {
            kind: "Foo",
            name: "foos",
            singularName: "",
            namespaced: true,
            verbs: [],
        };
        const v = "v1";
        const vr = new VersionedAPIResource(r, v);
        expect(vr.resource).toBe(r);
        expect(vr.groupVersion).toBe(v);
    });
});
