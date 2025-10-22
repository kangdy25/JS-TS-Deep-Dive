import ChromePaintBoard from "./PaintBoard_with_Browser/ChromePaintBoard.js";
import IEPaintBoard from "./PaintBoard_with_Browser/IEPaintBoard.js";

// ----------------------------------------------------
//  추상 팩토리 (Abstract Creator)
// ----------------------------------------------------
// => 객체 생성 방식을 정의하는 상위 클래스 (인터페이스 역할)
//    하위 클래스가 어떤 PaintBoard를 생성할지 결정한다.

abstract class AbstractPaintBoardFactory {
    // 구체 클래스가 반드시 구현해야 하는 '팩토리 메서드'
    abstract createPaintBoard(): PaintBoard;
}

// ----------------------------------------------------
//  구체 팩토리 (Concrete Creators)
// ----------------------------------------------------
// => 실제로 어떤 PaintBoard를 생성할지를 하위 클래스에서 결정한다.

// Chrome 전용 PaintBoard를 생성하는 팩토리
class ChromePaintBoardFactory extends AbstractPaintBoardFactory {
    override createPaintBoard(): PaintBoard {
        // Chrome 전용 PaintBoard의 싱글톤 인스턴스 반환
        return ChromePaintBoard.getInstance();
    }
}

// IE 전용 PaintBoard를 생성하는 팩토리
class IEPaintBoardFactory extends AbstractPaintBoardFactory {
    override createPaintBoard(): PaintBoard {
        // IE 전용 PaintBoard의 싱글톤 인스턴스 반환
        return IEPaintBoard.getInstance();
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
    abstract initializeMenu(): void;

    // 싱글톤 인스턴스 반환용 정적 메서드 (하위 클래스에서 구현)
    static getInstance() {}
}

// ----------------------------------------------------
//  클라이언트 코드 (Client)
// ----------------------------------------------------
// => 어떤 PaintBoard가 만들어지는지는 모르지만,
//    팩토리를 통해 생성해서 동일한 방식으로 사용 가능하다.
function main() {
    const paintboard = new ChromePaintBoardFactory().createPaintBoard();
    // 공통 인터페이스를 통해 동일한 방식으로 동작
    paintboard.initialize();
    paintboard.initializeMenu();
}

main();

export default PaintBoard;
