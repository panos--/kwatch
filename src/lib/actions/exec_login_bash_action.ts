import { ExecAction } from "./exec_action";

export class ExecLoginBashAction extends ExecAction {
    public getLabel() {
        return "Exec Login Bash";
    }

    protected getCommand(): string[] {
        return [ "bash", "-il" ];
    }
}
