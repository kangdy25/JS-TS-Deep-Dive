// 추상 클래스 PaintBoard를 상속받음 → 'Chrome' 환경용 구체적 구현 클래스
import PaintBoard from "./PaintBoardBase.js";

class ChromePaintBoard extends PaintBoard {
    // 싱글톤 인스턴스를 저장할 정적 필드
    private static instance: ChromePaintBoard;

    override initialize(): void {
        console.log("Chrome PaintBoard 초기화");
    }
    // 싱글톤 인스턴스를 반환하는 정적 메서드
    // 이미 생성된 인스턴스가 있으면 재사용, 없으면 새로 생성
    static override getInstance() {
        if (!this.instance) {
            this.instance = new ChromePaintBoard(
                document.querySelector("canvas")
            );
        }
        return this.instance;
    }
}

export default ChromePaintBoard;
