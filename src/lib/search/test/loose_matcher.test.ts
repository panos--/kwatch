import { LooseMatcherBuilder } from "../loose_matcher";

describe("loose matcher", () => {
    const builder = new LooseMatcherBuilder();

    it("should match empty string in empty search", () => {
        expect(builder.matcher("").test("")).toBe(true);
    });
    it("should match abc in abc", () => {
        expect(builder.matcher("abc").test("abc")).toBe(true);
    });
    it("should not match abc in ac", () => {
        expect(builder.matcher("abc").test("ac")).toBe(false);
    });
    it("should match ac in abc", () => {
        expect(builder.matcher("ac").test("abc")).toBe(true);
    });
    it("should not match ca in abc", () => {
        expect(builder.matcher("ca").test("abc")).toBe(false);
    });
    it("should not match ac in Abc", () => {
        expect(builder.matcher("ac").test("Abc")).toBe(false);
    });
    it("should match bde in abcdef", () => {
        expect(builder.matcher("bde").test("abcdef")).toBe(true);
    });
    it("should match .* in a.b*c", () => {
        expect(builder.matcher(".*").test("a.b*c")).toBe(true);
    });
    it("should not match .* in a*b.c", () => {
        expect(builder.matcher(".*").test("a*b.c")).toBe(false);
    });

    const caseSensitiveBuilder = new LooseMatcherBuilder({ caseInsensitive: false });
    it("should be case sensitive when option is specified", () => {
        expect(caseSensitiveBuilder.matcher("ac").test("abc")).toBe(true);
        expect(caseSensitiveBuilder.matcher("ac").test("ABC")).toBe(false);
    });
});

describe("case-insensitive loose matcher", () => {
    const builder = new LooseMatcherBuilder({ caseInsensitive: true });

    it("should match ac in abc", () => {
        expect(builder.matcher("ac").test("abc")).toBe(true);
    });
    it("should match ac in ABC", () => {
        expect(builder.matcher("ac").test("ABC")).toBe(true);
    });
    it("should match AC in ABC", () => {
        expect(builder.matcher("AC").test("ABC")).toBe(true);
    });
    it("should match AC in abc", () => {
        expect(builder.matcher("AC").test("abc")).toBe(true);
    });
    it("should match CA in abc", () => {
        expect(builder.matcher("CA").test("abc")).toBe(false);
    });
});
