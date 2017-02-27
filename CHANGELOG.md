# v0.3.0 (2017-02-27)
No known breaking changes.  We're now complying with semver from here forward.

Changes:
- Start using a change log!
- Clean up and add more complete provider specific examples
- Make README corrections and add more inline examples
- Add provider options documentation to the README
- Add unit tests
- Integrate with TravisCI, AppVeyor, and Coveralls
- Change ZeroMQ dependency to use better supported library with prebuilt binaries
- AWS config credentials can be set from your environment using recommended practices

Bug Fixes:
- AMQP provider implementation should work in more situations now
- AMQP unsubscribe and close functionality now is segmented appropriately
- ZeroMQ unsubscribe and close functionality now works correctly
- Connecting to an existing SQS queue with non-matching `attributes` now works