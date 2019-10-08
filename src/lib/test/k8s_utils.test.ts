import { K8sUtils } from "../k8s_utils";

describe("secrets decoder", () => {
    it("should decode properties", () => {
        const plainData = K8sUtils.decodeSecretData({
            foo: Buffer.from("foobar").toString("base64"),
            qux: Buffer.from("quxbaz").toString("base64"),
        });
        expect(Object.keys(plainData).length).toBe(2);
        expect(plainData.foo).toBe("foobar");
        expect(plainData.qux).toBe("quxbaz");
    });

    it("should work with empty secret", () => {
        const plainData = K8sUtils.decodeSecretData({});
        expect(Object.keys(plainData).length).toBe(0);
    });
});

describe("data to string converter", () => {
    it("should encode data as yaml", () => {
        const string = K8sUtils.dataToString({
            c: "foo",
            b: "bar",
            a: "qux",
        });
        expect(string).toBe("a: qux\nb: bar\nc: foo\n");
    });

    it("should work with empty string", () => {
        expect(K8sUtils.dataToString("")).toBe("''\n");
    });

    it("should work with null", () => {
        expect(K8sUtils.dataToString(null)).toBe("null\n");
    });
});

describe("api version comparator", () => {
    it("should compare versions correctly", () => {
        expect(K8sUtils.compareAPIVersion("v1", "v1alpha1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v1", "v1beta1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v2", "v1beta1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v2", "v3beta1")).toBe(-1);
        expect(K8sUtils.compareAPIVersion("v1alpha1", "v1")).toBe(-1);
        expect(K8sUtils.compareAPIVersion("v1alpha1", "v1alpha2")).toBe(-1);
        expect(K8sUtils.compareAPIVersion("v1alpha3", "v1alpha1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v1alpha3", "v1beta1")).toBe(-1);
        expect(K8sUtils.compareAPIVersion("v1beta1", "v1alpha1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v1", "v2")).toBe(-1);
        expect(K8sUtils.compareAPIVersion("v2", "v1")).toBe(1);
        expect(K8sUtils.compareAPIVersion("v1alpha1", "v1alpha1")).toBe(0);
        expect(K8sUtils.compareAPIVersion("v1", "v1")).toBe(0);
    });

    it("should throw on invalid version numbers", () => {
        expect(() => { K8sUtils.compareAPIVersion("foo", "v1"); }).toThrow(/Invalid argument/);
        expect(() => { K8sUtils.compareAPIVersion("v1", "foo"); }).toThrow(/Invalid argument/);
    });
});
