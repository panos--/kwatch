import escapeStringRegexp from "escape-string-regexp";
import { Matcher } from "./matcher";
import { MatcherBuilder } from "./matcher_builder";

export interface LooseMatcherOptions {
    caseInsensitive?: boolean;
}

export class LooseMatcher implements Matcher {
    private regex: RegExp;

    public constructor(search: string, options?: LooseMatcherOptions) {
        const pattern = search
            .split("")
            .filter(value => { return value.length > 0; })
            .map(value => escapeStringRegexp(value))
            .join(".*");
        const flags = options && options.caseInsensitive ? "i" : "";
        this.regex = new RegExp(pattern, flags);
    }

    public test(subject: string): boolean {
        return this.regex.test(subject);
    }
}

export class LooseMatcherBuilder implements MatcherBuilder {
    private options?: LooseMatcherOptions;

    public constructor(options?: LooseMatcherOptions) {
        this.options = options;
    }

    public matcher(search: string) {
        return new LooseMatcher(search, this.options);
    }
}
