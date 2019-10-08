import { mocked } from "ts-jest/utils";
import _ from "lodash";
import { APIListHelper, APIListModel, ModelContext } from "../api_list_widget";
import { K8sClient } from "../../client";
import { OptionItem, OptionGroup, OptionList } from "../select_list_widget";
import { AppState } from "../../app_context";
import { APIResource } from "../../api_resource";
import { MaybeMocked } from "ts-jest/dist/util/testing";

jest.mock("../../client");

function mockAPIResource(name: string, groupVersion?: string, group?: string) {
    return new APIResource({
        kind: _.capitalize(name),
        name: name,
        singularName: "",
        namespaced: true,
        verbs: [],
    }, groupVersion ? groupVersion : "v1", group !== undefined ? {
        name: group,
        versions: [],
    } : undefined);
}

describe("APIListHelper", () => {
    it("should assert mapping does not contain unknown categories", () => {
        expect(() => {
            new APIListHelper([], [{
                group: "",
                name: "",
                category: "unknown",
            }]);
        }).toThrow(/internal error/);

        expect(() => {
            new APIListHelper(["known"], [{
                group: "",
                name: "",
                category: "known"
            }]);
        }).not.toThrow(/internal error/);
    });
});

describe("APIListHelper resource filter", () => {
    it("should filter duplicate standard resources", () => {
        const helper = new APIListHelper([], []);
        const resources = [
            mockAPIResource("foos", "v1"),
            mockAPIResource("foos", "v1alpha1"),
        ];
        const filteredResources = helper.filterPreferredVersions(resources);
        expect(filteredResources).toHaveLength(1);
        expect(filteredResources[0].groupVersion).toEqual("v1");
    });

    it("should not filter custom resources", () => {
        const helper = new APIListHelper([], []);
        const res1 = mockAPIResource("foos", "v1", "foo.custom.org");
        const res2 = mockAPIResource("foos", "v1alpha1", "foo.custom.org");
        const filteredResources = helper.filterPreferredVersions([ res1, res2 ]);
        expect(filteredResources).toHaveLength(2);
        expect(filteredResources).toContain(res1);
        expect(filteredResources).toContain(res2);
    });
});

describe("APIListHelper single resource categorizer", () => {
    it("should return null category if nothing matched", () => {
        expect(new APIListHelper([], []).categorizeResource(mockAPIResource("tests"))).toBeNull();

        const helper = new APIListHelper([ "test" ], [{
            group: "",
            name: "foo",
            category: "test",
        }]);
        expect(helper.categorizeResource(mockAPIResource("tests"))).toBeNull();
    });

    it("should match undefined group with empty string", () => {
        const helper = new APIListHelper(["test"], [{group: "", name: /.*/, category: "test"}]);
        expect(helper.categorizeResource(mockAPIResource("tests", "v1"))).toEqual("test");
        expect(helper.categorizeResource(mockAPIResource("tests", "v1", "test"))).toBeNull();
    });

    it("should match group by string", () => {
        const helper = new APIListHelper(["test"], [{group: "testgroup", name: /.*/, category: "test"}]);
        expect(helper.categorizeResource(mockAPIResource("tests", "v1", "testgroup"))).toEqual("test");
        expect(helper.categorizeResource(mockAPIResource("tests", "v1", "testgroups"))).toBeNull();
    });

    it("should match group by regex", () => {
        const helper = new APIListHelper(["test"], [{group: /.*group/, name: "tests", category: "test"}]);
        expect(helper.categorizeResource(mockAPIResource("tests", "v1", "testgroup"))).toEqual("test");
        expect(helper.categorizeResource(mockAPIResource("tests", "v1", "test"))).toBeNull();
    });

    it("should match name by string", () => {
        const helper = new APIListHelper(["test"], [{group: "", name: "tests", category: "test"}]);
        expect(helper.categorizeResource(mockAPIResource("tests"))).toEqual("test");
        expect(helper.categorizeResource(mockAPIResource("teststests"))).toBeNull();
    });

    it("should match name be regex", () => {
        const helper = new APIListHelper(["test"], [{group: "", name: /t.*/, category: "test"}]);
        expect(helper.categorizeResource(mockAPIResource("tests"))).toEqual("test");
        expect(helper.categorizeResource(mockAPIResource("xesxs"))).toBeNull();
    });

    it("should return the first matching category", () => {
        const categories = ["specific", "catchall"];
        const mappingSpecific = {group: "", name: "tests", category: "specific"};
        const mappingCatchAll = {group: "", name: /.*/, category: "catchall"};
        const resource = mockAPIResource("tests", "v1");
        expect(new APIListHelper(categories, [mappingSpecific, mappingCatchAll]).categorizeResource(resource))
            .toEqual("specific");
        expect(new APIListHelper(categories, [mappingCatchAll, mappingSpecific]).categorizeResource(resource))
            .toEqual("catchall");
    });
});

describe("APIListHelper multiple resource categorizer", () => {
    it("should assert all resources match a category", () => {
        const helper = new APIListHelper([], []);
        expect(() => {
            helper.categorizeResources([mockAPIResource("tests")]);
        }).toThrow(/internal error/);
    });

    it("should group by category", () => {
        const helper = new APIListHelper(["one", "two"], [{
            group: "first",
            name: /.*/,
            category: "one",
        },{
            group: "second",
            name: /.*/,
            category: "two"
        }]);
        const foosResource = mockAPIResource("foos", "v1", "first");
        const barsResource = mockAPIResource("bars", "v1", "first");
        const bazesResource = mockAPIResource("bazes", "v1", "second");
        const groupedResources = helper.categorizeResources([
            foosResource,
            barsResource,
            bazesResource,
        ]);
        const keys = Object.keys(groupedResources);
        expect(keys).toHaveLength(2);
        expect(keys).toContain("one");
        expect(keys).toContain("two");
        expect(groupedResources.one).toHaveLength(2);
        expect(groupedResources.one).toContain(foosResource);
        expect(groupedResources.one).toContain(barsResource);
        expect(groupedResources.two).toHaveLength(1);
        expect(groupedResources.two).toContain(bazesResource);
    });
});

describe("APIListHelper resource sorter", () => {
    it("should sort lexically using resources' long name in-place", () => {
        const res1 = mockAPIResource("as");
        const res2 = mockAPIResource("as", "v1", "z");
        const res3 = mockAPIResource("bs");
        const resources = [res2, res3, res1];
        new APIListHelper([], []).sortResources(resources);
        expect(resources).toHaveLength(3);
        expect(resources[0]).toBe(res1);
        expect(resources[1]).toBe(res2);
        expect(resources[2]).toBe(res3);
    });
});

describe("APIListHelper option list builder", () => {
    it("should not add empty groups", () => {
        const helper = new APIListHelper(["a"], []);
        expect(helper.buildOptionList({}).toArray()).toHaveLength(0);
    });

    it("should add option groups in order", () => {
        const helper = new APIListHelper(["b", "a"], []);
        const result = helper.buildOptionList({
            a: [ mockAPIResource("foo") ],
            b: [ mockAPIResource("bar") ],
        }).toArray();
        expect(result).toHaveLength(4);
        expect(result[0]).toHaveProperty("options");
        expect((result[0] as OptionGroup<APIResource>).label).toEqual("b");
        expect(result[1]).toHaveProperty("value");
        expect((result[1] as OptionItem<APIResource>).value.getName()).toEqual("bar");
        expect(result[2]).toHaveProperty("options");
        expect((result[2] as OptionGroup<APIResource>).label).toEqual("a");
        expect(result[3]).toHaveProperty("value");
        expect((result[3] as OptionItem<APIResource>).value.getName()).toEqual("foo");
    });

    it("should sort option items", () => {
        const helper = new APIListHelper(["a"], []);
        const result = helper.buildOptionList({
            a: [mockAPIResource("bbb"), mockAPIResource("aaa")],
        }).toArray();
        expect(result).toHaveLength(3);
        expect(result[0]).toHaveProperty("options");
        expect(result[1]).toHaveProperty("value");
        expect((result[1] as OptionItem<APIResource>).value.getName()).toEqual("aaa");
        expect((result[2] as OptionItem<APIResource>).value.getName()).toEqual("bbb");
    });

    it("should use short name as label for standard resources", () => {
        const helper = new APIListHelper(["a"], []);
        const result = helper.buildOptionList({
            a: [mockAPIResource("foo")],
        }).toArray();
        expect(result).toHaveLength(2);
        expect(result[1].label).toEqual("foo");
    });

    it("should use long name as label for standard resources", () => {
        const helper = new APIListHelper(["a"], []);
        const result = helper.buildOptionList({
            a: [mockAPIResource("foo", "v1", "foo.custom.org")],
        }).toArray();
        expect(result).toHaveLength(2);
        expect(result[1].label).toEqual("foo.foo.custom.org");
    });
});

describe("APIListModel", () => {
    let ctx: ModelContext;
    let mockedClient: MaybeMocked<K8sClient>;
    let model: APIListModel;
    let updateCallback: jest.Mock<void, [OptionList<APIResource>, APIResource]>;
    let doneCallback: jest.Mock<void, [string]>;

    beforeEach(() => {
        let client = new K8sClient();
        mockedClient = mocked(client);
        ctx = {
            state: new AppState(),
            client: client,
        };
        model = new APIListModel(ctx);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        updateCallback = jest.fn((options, selected) => {});
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        doneCallback = jest.fn((error) => {});
    });

    const successMockImpl = async (cb: (error?: Error, resources?: APIResource[]) => void) => {
        cb(null, [
            mockAPIResource("foos"),
            mockAPIResource("bars"),
        ]);
    };

    it("should emit update and call done on success", () => {
        mockedClient.getListableAPIResources.mockImplementationOnce(successMockImpl);
        model.onUpdate(updateCallback);
        model.updateApiList(doneCallback);
        expect(doneCallback).toHaveBeenCalled();
        expect(updateCallback).toHaveBeenCalled();
        const options = updateCallback.mock.calls[0][0].toArray();
        expect(options.length).toBe(3);
        expect(options[0]).toHaveProperty("options");
        expect(options[1]).toHaveProperty("value");
        expect((options[1] as OptionItem<APIResource>).value.getName()).toEqual("bars");
        expect(options[2]).toHaveProperty("value");
        expect((options[2] as OptionItem<APIResource>).value.getName()).toEqual("foos");
    });

    it("should work without update listener", () => {
        mockedClient.getListableAPIResources.mockImplementationOnce(successMockImpl);
        model.updateApiList(doneCallback);
        expect(doneCallback).toHaveBeenCalled();
        expect(updateCallback).toHaveBeenCalledTimes(0);
    });

    it("should work without callback", () => {
        expect.assertions(1);
        mockedClient.getListableAPIResources.mockImplementationOnce(successMockImpl);
        model.updateApiList();
        expect(mockedClient.getListableAPIResources).toHaveBeenCalled();
    });

    it("should work with empty result", () => {
        mockedClient.getListableAPIResources
            .mockImplementationOnce(async (cb: (e?: Error, r?: APIResource[]) => void) => {
                cb(null, []);
            });
        model.onUpdate(updateCallback);
        model.updateApiList(doneCallback);
        expect(doneCallback).toHaveBeenCalled();
        expect(updateCallback).toHaveBeenCalled();
        expect(updateCallback.mock.calls[0].length).toBe(2);
        expect(updateCallback.mock.calls[0][0].toArray().length).toBe(0);
        expect(updateCallback.mock.calls[0][1]).toBeNull();
    });

    it("should pass error to callback", () => {
        mockedClient.getListableAPIResources
            .mockImplementationOnce(async (cb: (e?: Error, r?: APIResource[]) => void) => {
                cb(new Error("test-error-message"), null);
            });
        model.onUpdate(updateCallback);
        model.updateApiList(doneCallback);
        expect(updateCallback).not.toHaveBeenCalled();
        expect(doneCallback).toHaveBeenCalled();
        expect(doneCallback.mock.calls[0].length).toBe(1);
        expect(doneCallback.mock.calls[0][0]).toMatch("test-error-message");
    });

    it("should replace selected api resource in state with newly retrieved version", () => {
        const oldFoosResource = mockAPIResource("foos");
        const newFoosResource = mockAPIResource("foos");
        ctx.state.apiResource = oldFoosResource;
        mockedClient.getListableAPIResources
            .mockImplementationOnce(async (cb: (e?: Error, r?: APIResource[]) => void) => {
                cb(null, [newFoosResource]);
            });
        model.onUpdate(updateCallback);
        model.updateApiList();
        expect(updateCallback).toHaveBeenCalled();
        expect(updateCallback.mock.calls[0].length).toBe(2);
        expect(updateCallback.mock.calls[0][1]).toBe(newFoosResource);
        expect(ctx.state.apiResource).toBe(newFoosResource);
    });

    it("should preserve selected api resource in state if not found in newly retrieved resources", () => {
        const foosResource = mockAPIResource("foos");
        const barsResource = mockAPIResource("bars");
        ctx.state.apiResource = foosResource;
        mockedClient.getListableAPIResources
            .mockImplementationOnce(async (cb: (e?: Error, r?: APIResource[]) => void) => {
                cb(null, [barsResource]);
            });
        model.onUpdate(updateCallback);
        model.updateApiList();
        expect(updateCallback).toHaveBeenCalled();
        expect(updateCallback.mock.calls[0].length).toBe(2);
        expect(updateCallback.mock.calls[0][1]).toBe(foosResource);
        expect(ctx.state.apiResource).toBe(foosResource);
    });
});
