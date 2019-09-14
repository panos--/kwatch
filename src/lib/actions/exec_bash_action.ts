import { ExecAction } from "./exec_action";

export class ExecBashAction extends ExecAction {
    public getLabel() {
        return "Exec Bash";
    }

    protected getCommand(): string[] {
        return [ "bash" ];
    }
}
