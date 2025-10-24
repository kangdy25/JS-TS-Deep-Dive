// ----------------------------------------------------
//  추상 제품 (Abstract Product)
// ----------------------------------------------------
// => 모든 PaintBoard가 가져야 할 공통 속성과 메서드 정의
class PaintBoard {
    // 생성자는 하위 클래스만 접근 가능 (외부에서 직접 생성 불가)
    constructor(canvas) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error("canvas 엘리먼트를 활용하세요");
        }
    }
    // 싱글톤 인스턴스 반환용 정적 메서드 (하위 클래스에서 구현)
    static getInstance() {
        throw new Error("하위 클래스에서 구현해야 합니다.");
    }
}
export default PaintBoard;
