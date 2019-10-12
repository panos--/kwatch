import util from "util";

export const execFile = util.promisify(require("child_process").execFile);
