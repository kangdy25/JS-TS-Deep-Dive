import {
  ChromePaintBoardMenu,
  IEPaintBoardMenu,
} from "./AbstractFactoryMenu.js";
import {
  ChromePaintBoardHistory,
  IEPaintBoardHistory,
} from "./AbstractFactoryHistory.js";
import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";

// ----------------------------------------------------
//   Abstract Creator (추상 팩토리)
// ----------------------------------------------------
// => 객체 생성 방식을 정의하는 상위 클래스 (인터페이스 역할)
//    하위 클래스가 어떤 PaintBoard를 생성할지 결정한다.

export abstract class AbstractPaintBoardFactory {
  // 구체 클래스가 반드시 구현해야 하는 '팩토리 메서드'
  static createPaintBoard() {
    throw new Error("하위 클래스에서 구현하셔야 합니다.");
  }
  static createPaintBoardMenu(paintboard: PaintBoard) {
    throw new Error("하위 클래스에서 구현하셔야 합니다.");
  }
  static createPaintBoardHistory(paintboard: PaintBoard) {
    throw new Error("하위 클래스에서 구현하셔야 합니다.");
  }
}

// ----------------------------------------------------
//  Concrete Creators (구체 팩토리)
// ----------------------------------------------------
// => 실제로 어떤 PaintBoard를 생성할지를 하위 클래스에서 결정한다.

// Chrome 전용 PaintBoard를 생성하는 팩토리
export class ChromePaintBoardFactory extends AbstractPaintBoardFactory {
  static override createPaintBoard(): PaintBoard {
    return ChromePaintBoard.getInstance();
  }
  static override createPaintBoardMenu(paintboard: ChromePaintBoard) {
    return ChromePaintBoardMenu.getInstance(paintboard);
  }
  static override createPaintBoardHistory(paintboard: ChromePaintBoard) {
    return ChromePaintBoardHistory.getInstance(paintboard);
  }
}

// IE 전용 PaintBoard를 생성하는 팩토리
export class IEPaintBoardFactory extends AbstractPaintBoardFactory {
  static override createPaintBoard(): PaintBoard {
    return IEPaintBoard.getInstance();
  }
  static override createPaintBoardMenu(paintboard: IEPaintBoard) {
    return IEPaintBoardMenu.getInstance(paintboard);
  }
  static override createPaintBoardHistory(paintboard: IEPaintBoard) {
    return IEPaintBoardHistory.getInstance(paintboard);
  }
}

// ----------------------------------------------------
//  추상 제품 (Abstract Product)
// ----------------------------------------------------
// => 모든 PaintBoard가 가져야 할 공통 속성과 메서드 정의
abstract class PaintBoard {
  // 생성자는 하위 클래스만 접근 가능 (외부에서 직접 생성 불가)
  protected constructor(canvas: HTMLElement | null) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("canvas 엘리먼트를 활용하세요");
    }
  }

  abstract initialize(): void;

  // 싱글톤 인스턴스 반환용 정적 메서드 (하위 클래스에서 구현)
  static getInstance() {}
}

export default PaintBoard;
