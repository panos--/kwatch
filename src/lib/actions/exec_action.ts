import { Action } from "./action";
import { V1Namespace } from "@kubernetes/client-node";
import { APIResource } from "../client";
import { BlessedUtils } from "../blessed_utils";
import { ContainerPicker } from "../widgets/container_picker";
import { AppContext } from "../app_context";

export abstract class ExecAction implements Action {
    public abstract getLabel(): string;

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "pods";
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getPod(resource, namespace.metadata.name).then(pod => {
            let containers = pod.spec.containers.map(container => { return container.name; });
            if (containers.length == 0) {
                // should not happen
                throw "no containers found in pod";
            }
            else if (containers.length == 1) {
                this.executeCommandInternal(ctx, namespace, resource, containers[0]);
            }
            else {
                const containerPicker = new ContainerPicker(ctx, containers, ctx.screen);
                containerPicker.onSelect(container => {
                    this.executeCommandInternal(ctx, namespace, resource, container);
                });
                containerPicker.show();
            }
        }).catch(reason => {
            ctx.widgetFactory.error(
                `Error retrieving data of pod ${resource}\n\n`
                + `Reason: ${reason}`
            );
        });
    }

    protected abstract executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string,
        execCallback: (command: string, args?: string[]) => void): void;

    private executeCommandInternal(ctx: AppContext, namespace: V1Namespace, resource: string, container: string) {
        this.executeCommand(ctx, namespace, resource, container, (command: string, args: string[], wait?: boolean) => {
            const kubectlCmd = "kubectl";
            const kubectlArgs = [
                "-n",
                namespace.metadata.name,
                "exec",
                "-it",
                resource,
                "-c",
                container,
                "--"
            ];
            kubectlArgs.push(command);
            if (args) {
                kubectlArgs.push.apply(kubectlArgs, args);
            }

            const resultCallback = (err?: Error, success?: boolean) => {
                if (err) {
                    ctx.widgetFactory.error(
                        "Error executing command\n\n"
                        + `Reason: ${err.message}`
                    );
                }
                else if (!success) {
                    ctx.widgetFactory.error("Command returned with non-zero exit code");
                }
            };
            if (wait) {
                BlessedUtils.executeCommandWait(ctx.screen, kubectlCmd, kubectlArgs, resultCallback);
            }
            else {
                BlessedUtils.executeCommand(ctx.screen, kubectlCmd, kubectlArgs, resultCallback);
            }
        });
    }
}
