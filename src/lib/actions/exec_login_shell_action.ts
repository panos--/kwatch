import { ExecAction } from "./exec_action";

export class ExecLoginShellAction extends ExecAction {
    public getLabel() {
        return "Exec Login Shell";
    }

    protected getCommand(): string[] {
        return [ "sh", "-il" ];
    }
}
