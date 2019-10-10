import { LightColorScheme, DarkColorScheme } from "../color_scheme";

describe("color scheme", () => {
    it("should have light color scheme", () => {
        expect(new LightColorScheme()).toBeTruthy();
    });
    it("should have dark color scheme", () => {
        expect(new DarkColorScheme()).toBeTruthy();
    });
});
