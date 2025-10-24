class PaintBoard {
    // Singleton 클래스의 유일한 인스턴스를 저장할 정적(private static) 변수
    static instance;
    // 생성자를 private으로 만들어 외부에서 new 키워드로 인스턴스 생성 불가
    constructor(canvas) {
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error("canvas 엘리먼트를 활용하세요");
        }
    }
    initialize() { }
    initializeMenu() { }
    // 클래스의 유일한 인스턴스를 반환하는 정적 메서드
    static getInstance() {
        // 인스턴스가 아직 생성되지 않았다면 새로 생성
        if (!this.instance) {
            this.instance = new PaintBoard(document.querySelector("canvas"));
        }
        return this.instance;
    }
}
export default PaintBoard;
