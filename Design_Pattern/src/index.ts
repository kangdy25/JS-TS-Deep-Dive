import {
    ChromePaintBoardFactory,
    IEPaintBoardFactory,
} from "./FactoryMethod.js";

// ----------------------------------------------------
//  클라이언트 코드 (Client)
// ----------------------------------------------------
// => 어떤 PaintBoard가 만들어지는지는 모르지만,
//    팩토리를 통해 생성해서 동일한 방식으로 사용 가능하다.

function main() {
    const paintboard = ChromePaintBoardFactory.createPaintBoard();
    const paintboardMenu = ChromePaintBoardFactory.createPaintBoardMenu(
        paintboard,
        document.querySelector("#menu")!
    );
    const paintboardHistory =
        ChromePaintBoardFactory.createPaintBoardHistory(paintboard);

    // 공통 인터페이스를 통해 동일한 방식으로 동작
    paintboard.initialize();
    paintboardMenu.initialize([
        "back",
        "forward",
        "color",
        "pipette",
        "pen",
        "circle",
        "rectangle",
        "eraser",
        "save",
    ]);
    paintboardHistory.initialize();
}

main();
