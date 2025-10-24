import { ChromePaintBoardMenu, IEPaintBoardMenu, } from "./AbstractFactoryMenu.js";
import { ChromePaintBoardHistory, IEPaintBoardHistory, } from "./AbstractFactoryHistory.js";
import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";
// ----------------------------------------------------
//   Abstract Creator (추상 팩토리)
// ----------------------------------------------------
// => 객체 생성 방식을 정의하는 상위 클래스 (인터페이스 역할)
//    하위 클래스가 어떤 PaintBoard를 생성할지 결정한다.
export class AbstractPaintBoardFactory {
    // 구체 클래스가 반드시 구현해야 하는 '팩토리 메서드'
    static createPaintBoard() {
        throw new Error("하위 클래스에서 구현하셔야 합니다.");
    }
    static createPaintBoardMenu(paintboard, dom) {
        throw new Error("하위 클래스에서 구현하셔야 합니다.");
    }
    static createPaintBoardHistory(paintboard) {
        throw new Error("하위 클래스에서 구현하셔야 합니다.");
    }
}
// ----------------------------------------------------
//  Concrete Creators (구체 팩토리)
// ----------------------------------------------------
// => 실제로 어떤 PaintBoard를 생성할지를 하위 클래스에서 결정한다.
// Chrome 전용 PaintBoard를 생성하는 팩토리
export class ChromePaintBoardFactory extends AbstractPaintBoardFactory {
    static createPaintBoard() {
        return ChromePaintBoard.getInstance();
    }
    static createPaintBoardMenu(paintboard, dom) {
        return ChromePaintBoardMenu.getInstance(paintboard, dom);
    }
    static createPaintBoardHistory(paintboard) {
        return ChromePaintBoardHistory.getInstance(paintboard);
    }
}
// IE 전용 PaintBoard를 생성하는 팩토리
export class IEPaintBoardFactory extends AbstractPaintBoardFactory {
    static createPaintBoard() {
        return IEPaintBoard.getInstance();
    }
    static createPaintBoardMenu(paintboard, dom) {
        return IEPaintBoardMenu.getInstance(paintboard, dom);
    }
    static createPaintBoardHistory(paintboard) {
        return IEPaintBoardHistory.getInstance(paintboard);
    }
}
