import PaintBoard from "./Singleton.js";
import paintboardFactory from "./SimpleFactory.js";

function main() {
    paintboardFactory("ie");
    paintboardFactory("chrome");
}

main();
