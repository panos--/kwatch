import { Action } from "./action";
import { APIResource } from "../api_resource";
import { V1Namespace } from "@kubernetes/client-node";
import { K8sUtils } from "../k8s_utils";
import { BlessedUtils } from "../blessed_utils";
import { AppContext } from "../app_context";

export class DumpSecretsAction implements Action {
    public getLabel() {
        return "Dump secrets";
    }

    public appliesTo(apiResource: APIResource): boolean {
        return apiResource.resource.name == "secrets";
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getSecret(resource, namespace.metadata.name).then(secret => {
            const decodedSecret = K8sUtils.dataToString(K8sUtils.decodeSecretData(secret.data));
            // BlessedUtils.runOffScreen(screen, true, () => {
            //     // process.stdout.write("Would dump secret.\n");
            //     fs.writeSync(1, "Would dump secret.\n");
            //     fs.fsyncSync(1);
            // });
            // TODO: Replace this quick hack with a proper implementation avoiding the use of Screen.exec()
            // See BlessedUtils.runOffScreen().
            process.env.KWATCH_SECRET_DUMP = `\nDump of secret ${namespace.metadata.name}/${resource}:\n\n${decodedSecret}`;
            BlessedUtils.executeCommandWait(ctx.screen, "sh", ["-c", "echo \"$KWATCH_SECRET_DUMP\""], (err, success) => {
                process.env.KWATCH_SECRET_DUMP = "";
                if (err) {
                    ctx.widgetFactory.error(
                        `Error dumping secret ${resource}\n\n`
                        + `Reason: ${err.message}`
                    );
                }
                else if (!success) {
                    ctx.widgetFactory.error(
                        `Error dumping secret ${resource}\n\n`
                        + "Reason: Command returned with non-zero exit code"
                    );
                }
            });
        }).catch(reason => {
            ctx.widgetFactory.error(
                `Error retrieving data of secret ${resource}\n\n`
                + `Reason: ${reason}`
            );
        });
    }

}
