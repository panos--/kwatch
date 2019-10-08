import { APIResource } from "../api_resource";
import { V1APIResource, V1APIGroup } from "@kubernetes/client-node";

describe("APIResource", () => {
    let resource: V1APIResource;
    let group: V1APIGroup;

    beforeEach(() => {
        resource = {
            kind: "Foo",
            name: "foos",
            singularName: "foo",
            namespaced: true,
            verbs: [],
        };
        group = {
            name: "test",
            versions: []
        };
    });

    it("should construct correctly", () => {
        const r = new APIResource(resource, "v1", group);
        expect(r.resource).toBe(resource);
        expect(r.groupVersion).toBe("v1");
        expect(r.group).toBe(group);
    });

    it("should have correct access methods", () => {
        const r = new APIResource(resource, "v1", group);
        expect(r.getName()).toBe("foos");
        expect(r.getCapitalizedName()).toBe("Foos");
        expect(r.getLongName()).toBe("foos.test");
        expect(r.getFullName()).toBe("foos.test/v1");
        expect(r.getSingularName()).toBe("foo");
        expect(r.getCapitalizedSingularName()).toBe("Foo");
        expect(r.isCustomResource()).toBe(false);
    });

    it("should work without group", () => {
        const r = new APIResource(resource, "v1");
        expect(r.getLongName()).toBe("foos");
        expect(r.isCustomResource()).toBe(false);
    });

    it("should work without singular name", () => {
        resource.singularName = "";
        const r = new APIResource(resource, "v1");
        expect(r.getSingularName()).toBe("foo");
    });

    it("should detect custom resources", () => {
        let r: APIResource;

        group.name = "custom.test";
        r = new APIResource(resource, "v1", group);
        expect(r.isCustomResource()).toBe(true);

        group.name = "custom.test.k8s.io";
        r = new APIResource(resource, "v1", group);
        expect(r.isCustomResource()).toBe(false);
    });
});
