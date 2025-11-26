import { loader } from "."
import path from "path";

export const LoaderHelper = {
    getDomainByPath: (_path: string) => {
        return loader.from("domain").list().find((domain) => path.resolve(_path).startsWith(path.resolve(domain.dir)));
    },
}