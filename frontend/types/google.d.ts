export {};

declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: unknown;
    };
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: google.accounts.oauth2.TokenResponse) => void;
          }) => google.accounts.oauth2.TokenClient;
          revoke: (token: string) => void;
        };
      };
      picker: {
        PickerBuilder: new () => google.picker.PickerBuilder;
        DocsView: new (viewId: google.picker.ViewId) => google.picker.DocsView;
        ViewId: {
          DOCS: google.picker.ViewId;
          DOCS_VIDEOS: google.picker.ViewId;
        };
        DocsViewMode: {
          LIST: google.picker.DocsViewMode;
          GRID: google.picker.DocsViewMode;
        };
        Feature: {
          MULTISELECT_ENABLED: google.picker.Feature;
          NAV_HIDDEN: google.picker.Feature;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
      };
    };
  }

  namespace google {
    namespace accounts {
      namespace oauth2 {
        interface TokenResponse {
          access_token: string;
          error?: string;
          expires_in: number;
          scope: string;
          token_type: string;
        }

        interface TokenClient {
          callback: (response: TokenResponse) => void;
          requestAccessToken: (config?: { prompt?: string }) => void;
        }
      }
    }

    namespace picker {
      type ViewId = symbol;
      type DocsViewMode = symbol;
      type Feature = symbol;

      interface DocsView {
        setMode: (mode: DocsViewMode) => DocsView;
        setMimeTypes: (mimeTypes: string) => DocsView;
      }

      interface PickerBuilder {
        setDeveloperKey: (key: string) => PickerBuilder;
        setAppId: (appId: string) => PickerBuilder;
        setOAuthToken: (token: string) => PickerBuilder;
        addView: (view: DocsView | ViewId) => PickerBuilder;
        setCallback: (callback: (data: ResponseObject) => void) => PickerBuilder;
        enableFeature: (feature: Feature) => PickerBuilder;
        build: () => Picker;
      }

      interface Picker {
        setVisible: (visible: boolean) => void;
      }

      interface ResponseObject {
        action: string;
        docs: Document[];
      }

      interface Document {
        id: string;
        name: string;
        mimeType: string;
        url: string;
      }
    }
  }
}
