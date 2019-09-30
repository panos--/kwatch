import { Matcher } from "./matcher";

export interface MatcherBuilder {
    matcher(search: string): Matcher;
}
