import { APIGroupResources } from "../api_group_resources";
import { V1APIGroup, V1APIResource } from "@kubernetes/client-node";

describe("APIGroupResources", () => {
    let group: V1APIGroup;

    beforeEach(() => {
        group = {
            name: "foo",
            versions: [],
        };
    });

    it("should construct correctly", () => {
        const gr = new APIGroupResources(group);
        expect(gr).toBeTruthy();
        expect(gr.group).toBe(group);
        expect(gr.getNewestResources()).toHaveLength(0);
    });

    it("should return newest versions of each api resource", () => {
        const fooResource: V1APIResource = {
            kind: "Foo",
            name: "foos",
            singularName: "",
            namespaced: true,
            verbs: [],
        };
        const barResource: V1APIResource = {
            kind: "Bar",
            name: "bars",
            singularName: "",
            namespaced: true,
            verbs: [],
        };
        const quxResource: V1APIResource = {
            kind: "Qux",
            name: "quxs",
            singularName: "",
            namespaced: true,
            verbs: [],
        };

        const gr = new APIGroupResources(group);

        gr.addResource(fooResource, "v1");
        gr.addResource(fooResource, "v1alpha1");
        gr.addResource(fooResource, "v1beta1");

        gr.addResource(barResource, "v1beta1");
        gr.addResource(barResource, "v1");
        gr.addResource(barResource, "v2alpha1");

        gr.addResource(quxResource, "v3alpha3");

        const result = gr.getNewestResources();
        expect(result.length).toBe(3);

        const fooResult = result.find(vr => vr.resource.name == "foos");
        expect(fooResult).toBeDefined();
        expect(fooResult.groupVersion).toEqual("v1");

        const barResult = result.find(vr => vr.resource.name == "bars");
        expect(barResult).toBeDefined();
        expect(barResult.groupVersion).toEqual("v2alpha1");

        const quxResult = result.find(vr => vr.resource.name == "quxs");
        expect(quxResult).toBeDefined();
        expect(quxResult.groupVersion).toEqual("v3alpha3");
    });
});
