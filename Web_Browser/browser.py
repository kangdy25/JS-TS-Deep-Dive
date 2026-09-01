import socket

class URL:
    def __init__(self, url):
        # ://을 기준으로 scheme과 url을 분할하기
        self.scheme, url = url.split("://", 1)
        assert self.scheme == "http"

        if "/" not in url:
            url = url + "/"
        # /를 기준으로 host와 path를 분할하기
        self.host, url = url.split("/", 1)
        self.path = "/" + url

    def request(self):
        s = socket.socket(
            family=socket.AF_INET, # 다른 컴퓨터를 찾는 주소 패밀리
            type=socket.SOCK_STREAM, # 임의의 양의 데이터를 전송하는 소켓의 타입
            proto=socket.IPPROTO_TCP # 두 컴퓨터가 연결을 설정하는 단계를 설정하는 프로토콜
        )
        # 80번 포트에 연결
        s.connect((self.host, 80))

        # format 메서드를 통해 path와 host 바인딩
        request = "GET {} HTTP/1.0\r\n".format(self.path)
        request += "Host: {}\r\n".format(self.host)
        request += "\r\n" # 두 번의 줄바꿈을 통해 서버에 요청 전송
        s.send(request.encode("utf9")) # encode()는 텍스트를 바이트로 변환함

        # 바이트가 포함된 파일 형식의 객체를 반환하며 루프를 감추는 헬퍼 함수 makefile 사용
        response = s.makefile("r", encoding="utf8", newline="\r\n")
        statusline = response.readline()
        version, status, explanation = statusline.split(" ", 2)

        response_headers = {}
        while True:
            line = response.readline()
            if line == "\r\n": break # 빈줄을 만나면 헤더 파싱 루프 종료
            header, value = line.split(":", 1) # 콜론(:)을 기준으로 헤더 이름과 헤더 값 분리
            response_headers[header.casefold()] = value.strip() # 소문자 표준화 및 공백, 줄바꿈 문자 제거

        assert "transfer-encoding" not in response_headers
        assert "content-encoding" not in response_headers

        # 헤더 이후 남은 데이터 스트림을 모두 읽어오고 소켓 연결 해제
        body = response.read()
        s.close()

        # 수신된 최종 문자열 반환
        return body