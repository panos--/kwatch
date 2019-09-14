import { ExecAction } from "./exec_action";

export class ExecShellAction extends ExecAction {
    public getLabel() {
        return "Exec Shell";
    }

    protected getCommand(): string[] {
        return [ "sh" ];
    }
}
