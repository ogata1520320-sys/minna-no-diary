self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    self.clients.claim()
  );
});

self.addEventListener(
  'push',
  event => {

    let data = {};

    try {
      data = event.data
        ? event.data.json()
        : {};
    } catch (error) {
      data = {
        title: 'みんなの日記',
        body: event.data
          ? event.data.text()
          : '新しい通知があります。'
      };
    }

    const title =
      data.title ||
      'みんなの日記';

    const options = {
      body:
        data.body ||
        '新しい通知があります。',
      icon:
        data.icon ||
        './icon-192.png',
      badge:
        data.badge ||
        './icon-192.png',
      data: {
        url:
          data.url ||
          './'
      }
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);


self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const url =
      event.notification.data &&
      event.notification.data.url
        ? event.notification.data.url
        : './';

    event.waitUntil(
      self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clients => {

        for (const client of clients) {

          if (
            'focus' in client
          ) {

            client.navigate(url);

            return client.focus();

          }

        }

        if (
          self.clients.openWindow
        ) {

          return self.clients.openWindow(
            url
          );

        }

      })
    );

  }
);