from app.ai.client import _RedactingClient, redact_personal_data


class Capture:
    def __init__(self):
        self.messages = self
        self.kwargs = None

    def create(self, **kwargs):
        self.kwargs = kwargs
        return object()


def test_redacts_iin_bin_email_and_phone_before_provider_call():
    capture = Capture()
    client = _RedactingClient(capture)
    client.messages.create(
        model="test",
        system="Профиль БИН 123456789012",
        messages=[{
            "role": "user",
            "content": "ИИН 987654321098, test@example.kz, телефон +7 701 123 45 67",
        }],
    )
    assert "123456789012" not in capture.kwargs["system"]
    content = capture.kwargs["messages"][0]["content"]
    assert "987654321098" not in content
    assert "test@example.kz" not in content
    assert "701 123 45 67" not in content


def test_redaction_does_not_destroy_normal_program_numbers():
    text = "Сумма 1500000000 тенге, ставка 5%, срок 84 месяца"
    assert redact_personal_data(text) == text
