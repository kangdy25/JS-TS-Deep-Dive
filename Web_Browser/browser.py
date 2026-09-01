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