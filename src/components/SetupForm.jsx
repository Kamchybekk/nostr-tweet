import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Button, styled } from '@mui/material';
import CreatableSelect from 'react-select/creatable';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { useFormik } from 'formik';
import { validationSchemaForRelays } from '../helpers/validations';
import { getPublicKey, generateSecretKey } from 'nostr-tools';
import { NDKPrivateKeySigner, NDKEvent } from '@nostr-dev-kit/ndk';

function byteArrayToHexString(byteArray) {
  return Array.from(byteArray, function (byte) {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
}

function hexStringToByteArray(hexString) {
  var bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (var i = 0, j = 0; i < hexString.length; i += 2, j++) {
    bytes[j] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

const customStyles = (error) => ({
  control: (provided) => ({
    ...provided,
    borderColor: error ? 'red' : provided.borderColor,
    boxShadow: error ? '0 0 0 1px red' : provided.boxShadow,
    '&:hover': {
      borderColor: error ? 'red' : provided.borderColor,
    },
  }),
});

function SetupForm({ openModal, setOpenModal, username, resetUsername }) {
  const [privateKey, setPrivateKey] = useState('');

  useEffect(() => {
    let savedPrivateKey = localStorage.getItem('nostrPrivateKey');
    if (!savedPrivateKey) {
      savedPrivateKey = byteArrayToHexString(generateSecretKey());
      localStorage.setItem('nostrPrivateKey', savedPrivateKey);
    }
    setPrivateKey(savedPrivateKey);
  }, []);

  const formik = useFormik({
    initialValues: { selectedRelays: [] },
    validationSchema: validationSchemaForRelays,
    onSubmit: async (values) => {
      if (!privateKey) {
        toast.error('Private key is not set');
        return;
      }
      const privateKeyBytes = hexStringToByteArray(privateKey);
      const npub = getPublicKey(privateKeyBytes);
      const signer = new NDKPrivateKeySigner(privateKeyBytes);
      const KIND_TEST = 100030117;
      const event = new NDKEvent();
      event.kind = KIND_TEST;
      event.pubkey = npub;
      event.created_at = Math.floor(Date.now() / 1000);
      event.content = '';
      event.tags = [];
      const signedEvent = await signer.sign(event);
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_ENDPOINT}/add`,
          {
            username,
            relays: values.selectedRelays.map((item) => item.value),
          },
          {
            headers: {
              Authorization: `Nostr ${JSON.stringify(event)}`,
            },
          }
        );
        toast.success('Success!');
        resetUsername();
        setOpenModal(false);
      } catch (error) {
        if (error.response && error.response.status === 403) {
          toast.error('Forbidden: Access Denied');
        } else {
          toast.error('Error: ' + error.message);
        }
      }
    },
  });

  return (
    <div>
      <ToastContainer />
      <Modal open={openModal} onClose={() => setOpenModal(false)}>
        <FormStyled onSubmit={formik.handleSubmit}>
          <label>Relays</label>
          <CreatableSelect
            isMulti
            name="selectedRelays"
            classNamePrefix="select"
            onChange={(value) => formik.setFieldValue('selectedRelays', value)}
            value={formik.values.selectedRelays}
            styles={customStyles(
              formik.errors.selectedRelays && formik.touched.selectedRelays
            )}
          />
          <StyledButton size="small" type="submit" variant="contained">
            OK
          </StyledButton>
        </FormStyled>
      </Modal>
    </div>
  );
}

export default SetupForm;

const FormStyled = styled('form')`
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: 'Raleway', sans-serif;
`;

const StyledButton = styled(Button)`
  width: 100px;
`;
