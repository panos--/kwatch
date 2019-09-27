import escapeStringRegexp from "escape-string-regexp";

export class LooseMatcher {
    private regex: RegExp;

    public constructor(search: string) {
        const pattern = search
            .split("")
            .filter(value => { return value.length > 0; })
            .map(value => escapeStringRegexp(value))
            .join(".*");
        this.regex = new RegExp(pattern);
    }

    public test(string: string): boolean {
        return this.regex.test(string);
    }
}
