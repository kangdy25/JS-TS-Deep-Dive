// 추상 클래스 PaintBoard를 상속받음 → 'IE' 환경용 구체적 구현 클래스
import PaintBoard from "../FactoryMethod";

class IEPaintBoard extends PaintBoard {
  // 싱글톤 인스턴스를 저장할 정적 필드
  private static instance: IEPaintBoard;

  initialize() {}

  // 싱글톤 인스턴스를 반환하는 정적 메서드
  // 이미 생성된 인스턴스가 있으면 재사용, 없으면 새로 생성
  static override getInstance() {
    if (!this.instance) {
      this.instance = new IEPaintBoard(document.querySelector("canvas"));
    }
    return this.instance;
  }
}

export default IEPaintBoard;
